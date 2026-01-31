import path from "node:path";
import * as vscode from "vscode";
import { DeepSightCodeLensProvider } from "./codelens";
import { DeepSightViewProvider } from "./webview";
import {
  getSensitivePaths,
  getServerUrl,
  getWikiLimits,
  getWikiScope,
} from "./utils/config";
import { buildFrontMatter, splitFrontMatter } from "./utils/frontmatter";
import { extractSymbolName } from "./utils/symbols";
import { getToolDisplayInfo } from "./utils/toolDisplay";

// Debug output channel
let outputChannel: vscode.OutputChannel;

let viewProvider: DeepSightViewProvider;
let isAnalyzing = false;
let wikiAbortController: AbortController | null = null;

const getBasename = (value: string) => path.basename(value);

export function activate(context: vscode.ExtensionContext) {
  // Create output channel for debugging
  outputChannel = vscode.window.createOutputChannel("DeepSight Debug");
  outputChannel.appendLine("DeepSight extension activated");

  // Register CodeLens provider
  const codeLensProvider = new DeepSightCodeLensProvider();
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    [
      { language: "c" },
      { language: "cpp" },
      { language: "typescript" },
      { language: "javascript" },
      { language: "typescriptreact" },
      { language: "javascriptreact" },
      { language: "python" },
      { language: "go" },
      { language: "rust" },
      { language: "java" },
    ],
    codeLensProvider
  );

  // Register WebView provider
  viewProvider = new DeepSightViewProvider(context.extensionUri);
  const webviewDisposable = vscode.window.registerWebviewViewProvider(
    DeepSightViewProvider.viewType,
    viewProvider
  );

  // Register commands
  const explainCommand = vscode.commands.registerCommand(
    "deepsight.explain",
    (document: vscode.TextDocument, line: number) => {
      analyzeCode(document, line, "explain");
    }
  );

  const auditCommand = vscode.commands.registerCommand(
    "deepsight.audit",
    (document: vscode.TextDocument, line: number) => {
      analyzeCode(document, line, "audit");
    }
  );

  const openWikiCommand = vscode.commands.registerCommand("deepsight.openWiki", async () => {
    await vscode.commands.executeCommand("deepsight.resultView.focus");
    await viewProvider.navigateTo("wiki");
  });

  const generateWikiCommand = vscode.commands.registerCommand("deepsight.generateWiki", async () => {
    await generateWiki();
  });

  const cancelWikiCommand = vscode.commands.registerCommand("deepsight.cancelWiki", () => {
    cancelWikiGeneration();
  });

  const explainAtLineCommand = vscode.commands.registerCommand(
    "deepsight.explainAtLine",
    async () => {
      await analyzeAtCustomLine("explain");
    }
  );

  const auditAtLineCommand = vscode.commands.registerCommand(
    "deepsight.auditAtLine",
    async () => {
      await analyzeAtCustomLine("audit");
    }
  );

  // Command to show debug output
  const showDebugCommand = vscode.commands.registerCommand(
    "deepsight.showDebug",
    () => {
      outputChannel.show();
    }
  );

  context.subscriptions.push(
    codeLensDisposable,
    webviewDisposable,
    viewProvider,
    explainCommand,
    auditCommand,
    explainAtLineCommand,
    auditAtLineCommand,
    openWikiCommand,
    generateWikiCommand,
    cancelWikiCommand,
    showDebugCommand,
    outputChannel
  );
}

async function analyzeAtCustomLine(mode: "explain" | "audit"): Promise<void> {
  if (isAnalyzing) {
    vscode.window.showInformationMessage("DeepSight: 正在分析中，请等待完成。");
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("DeepSight: 没有可用的编辑器。");
    return;
  }

  const document = editor.document;
  const line = editor.selection.active.line;

  await analyzeCode(document, line, mode);
}

async function analyzeCode(
  document: vscode.TextDocument,
  line: number,
  mode: "explain" | "audit"
) {
  if (isAnalyzing) {
    vscode.window.showInformationMessage("DeepSight: 正在分析中，请等待完成。");
    return;
  }
  isAnalyzing = true;

  const serverUrl = getServerUrl(vscode.workspace.getConfiguration("deepsight"));

  const filePath = document.uri.fsPath;
  const fileName = getBasename(filePath) || filePath;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const cwd = workspaceFolder?.uri.fsPath || path.dirname(filePath);

  // Get symbol name at line for display
  const lineText = document.lineAt(line).text;

  const symbolName = extractSymbolName(lineText);

  const anchor = symbolName || `Line ${line + 1}`;

  outputChannel.appendLine(`\n${"=".repeat(50)}`);
  outputChannel.appendLine(`[${new Date().toISOString()}] Starting analysis`);
  outputChannel.appendLine(`  File: ${filePath}`);
  outputChannel.appendLine(`  Line: ${line + 1}`);
  outputChannel.appendLine(`  Mode: ${mode}`);
  outputChannel.appendLine(`  Anchor: ${anchor}`);

  // Focus the DeepSight view first (webview 重建时会自动恢复状态)
  await vscode.commands.executeCommand("deepsight.resultView.focus");

  // Ensure analysis output is visible
  await viewProvider.navigateTo("analysis");

  // Set loading state immediately
  viewProvider.setLoading(`${fileName}:${anchor}`, mode);

  try {
    const response = await fetch(`${serverUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: filePath,
        line: line + 1, // 1-indexed
        lineText,
        mode,
        cwd,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let messageCount = 0;
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          outputChannel.appendLine(`[SSE] Event: ${line.slice(6).trim()}`);
        }
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (!data) continue;

          try {
            const msg = JSON.parse(data);
            messageCount++;
            const textAdded = handleSSEMessage(msg, messageCount);
            if (textAdded) {
              chunkCount++;
            }
          } catch (e) {
            outputChannel.appendLine(`[SSE] Parse error: ${e}`);
          }
        }
      }
    }

    outputChannel.appendLine(`[Done] Total messages: ${messageCount}, Text chunks: ${chunkCount}`);
    viewProvider.setComplete();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    outputChannel.appendLine(`[Error] ${message}`);
    viewProvider.setError(message);
    vscode.window.showErrorMessage(`DeepSight: ${message}`);
  } finally {
    isAnalyzing = false;
  }
}

async function generateWiki() {
  if (wikiAbortController) {
    vscode.window.showInformationMessage("DeepSight: Wiki 正在生成中，请先取消或等待完成。");
    return;
  }

  await vscode.commands.executeCommand("deepsight.resultView.focus");
  await viewProvider.navigateTo("wiki");

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("DeepSight: No workspace folder found.");
    return;
  }

  const cwd = workspaceFolder.uri.fsPath;
  const config = vscode.workspace.getConfiguration("deepsight");
  const serverUrl = getServerUrl(config);
  const scope = getWikiScope(config);
  const sensitivePaths = getSensitivePaths(config);
  const limits = getWikiLimits(config);

  const requestBody = {
    cwd,
    scope,
    sensitivePaths,
    limits,
  };

  outputChannel.appendLine(`\n${"=".repeat(50)}`);
  outputChannel.appendLine(`[${new Date().toISOString()}] Starting wiki generation`);
  outputChannel.appendLine(`  Server: ${serverUrl}`);
  outputChannel.appendLine(`  Scope: include=${JSON.stringify(scope.include)} exclude=${JSON.stringify(scope.exclude)}`);
  outputChannel.appendLine(`  SensitivePaths: ${JSON.stringify(sensitivePaths)}`);
  outputChannel.appendLine(`  Limits: ${JSON.stringify(limits)}`);

  const controller = new AbortController();
  wikiAbortController = controller;

  // Sync generation state to Webview
  viewProvider.startWikiGeneration();

  try {
    const response = await fetch(`${serverUrl}/wiki/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        outputChannel.appendLine(`[Wiki SSE] Event: ${line.slice(6).trim()}`);
      }
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      try {
        const msg = JSON.parse(data) as WikiEvent;
        await handleWikiEvent(msg, {
          workspaceRoot: workspaceFolder.uri,
          scope,
          serverUrl,
        });
        } catch (e) {
          outputChannel.appendLine(`[Wiki SSE] Parse error: ${e}`);
        }
      }
    }

    outputChannel.appendLine(`[Wiki] Done`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // Handle both common abort message variants from different environments
    const isAbortError = message === "The user aborted a request." ||
                         message === "This operation was aborted" ||
                         /aborted/i.test(message);
    if (!isAbortError) {
      outputChannel.appendLine(`[Wiki Error] ${message}`);
      viewProvider.setWikiGenerationError(message);
      vscode.window.showErrorMessage(`DeepSight: ${message}`);
    } else {
      outputChannel.appendLine(`[Wiki] Aborted`);
      viewProvider.setWikiGenerationCanceled("Wiki generation canceled");
    }
  } finally {
    wikiAbortController = null;
  }
}

function cancelWikiGeneration() {
  if (!wikiAbortController) {
    vscode.window.showInformationMessage("DeepSight: 没有正在进行的 Wiki 生成任务。");
    return;
  }
  wikiAbortController.abort();
  wikiAbortController = null;
  viewProvider.setWikiGenerationCanceled("Wiki generation canceled");
  outputChannel.appendLine(`[Wiki] Cancel requested`);
}

type WikiEvent =
  | {
      type: "progress";
      phase: "scanning" | "drafting" | "writing";
      pct: number;
      message?: string;
      page?: string;
    }
  | {
      type: "page";
      path: string;
      title: string;
      confidence: "low" | "medium" | "high";
      markdown: string;
      blindSpots?: string[];
    }
  | { type: "done" }
  | { type: "error"; code: string; message: string };

async function handleWikiEvent(
  event: WikiEvent,
  context: { workspaceRoot: vscode.Uri; scope: { include: string[]; exclude: string[] }; serverUrl: string }
): Promise<void> {
  switch (event.type) {
    case "progress":
      outputChannel.appendLine(`  [Wiki ${event.phase}] ${event.pct}% ${event.message || ""}`);
      viewProvider.updateWikiGenerationProgress({
        phase: event.phase,
        pct: event.pct,
        message: event.message,
        page: event.page,
      });
      return;
    case "page":
      await writeWikiPage(context.workspaceRoot, event, context);
      return;
    case "error":
      outputChannel.appendLine(`[Wiki Error] ${event.code}: ${event.message}`);
      viewProvider.setWikiGenerationError(event.message);
      vscode.window.showErrorMessage(`DeepSight: ${event.message}`);
      return;
    case "done":
      viewProvider.setWikiGenerationDone("Wiki generation complete");
      return;
  }
}

async function writeWikiPage(
  workspaceRoot: vscode.Uri,
  page: { path: string; title: string; confidence: "low" | "medium" | "high"; markdown: string; blindSpots?: string[] },
  context: { scope: { include: string[]; exclude: string[] }; serverUrl: string }
): Promise<void> {
  const wikiDir = vscode.Uri.joinPath(workspaceRoot, ".deepsight", "wiki");
  await vscode.workspace.fs.createDirectory(wikiDir);

  const targetPath = page.path.replace(/^\/+/, "");
  const pageUri = vscode.Uri.joinPath(wikiDir, ...targetPath.split("/"));

  const isHome = targetPath.toLowerCase() === "home.md";
  if (isHome) {
    // Home.md is sometimes pre-created as a short template on startup.
    // Only skip overwriting if it looks like a real (user-written) manifest.
    const existingHome = await readWikiPageSafe(pageUri);
    const lineCount = existingHome.body
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean).length;
    if (lineCount >= 40) {
      outputChannel.appendLine(`[Wiki] Skip Home.md (looks like a manifest, lines=${lineCount})`);
      return;
    }
  }

  const now = new Date().toISOString();
  const existing = await readWikiPageSafe(pageUri);
  const frontMatter = buildFrontMatter({
    title: page.title,
    now,
    existingFrontMatter: existing.frontMatter,
    confidence: page.confidence,
    blindSpots: page.blindSpots,
    scope: context.scope,
    serverUrl: context.serverUrl,
  });

  const content = `${frontMatter}\n\n${page.markdown.trim()}\n`;
  await writeFileAtomically(pageUri, content);
  outputChannel.appendLine(`[Wiki] Wrote ${targetPath}`);
}

async function readWikiPageSafe(uri: vscode.Uri): Promise<{ frontMatter: string; body: string }> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder().decode(bytes);
    return splitFrontMatter(text);
  } catch {
    return { frontMatter: "", body: "" };
  }
}

async function writeFileAtomically(uri: vscode.Uri, content: string): Promise<void> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  const tmpUri = uri.with({ path: `${uri.path}.tmp` });
  await vscode.workspace.fs.writeFile(tmpUri, bytes);
  await vscode.workspace.fs.rename(tmpUri, uri, { overwrite: true });
}

// Track current tool call state
let currentToolName: string | null = null;
let currentToolInput: string = "";

function handleSSEMessage(msg: any, msgIndex: number): boolean {
  outputChannel.appendLine(`[MSG #${msgIndex}] type=${msg.type}, event.type=${msg.event?.type || "N/A"}`);

  if (msg.type === "stream_event" && msg.event) {
    const event = msg.event;

    // Handle content block start
    if (event.type === "content_block_start" && event.content_block) {
      const block = event.content_block;
      if (block.type === "tool_use") {
        currentToolName = block.name;
        currentToolInput = "";
        outputChannel.appendLine(`  [TOOL START] ${block.name} (id: ${block.id})`);
        // Create new tool block
        viewProvider.startBlock("tool", { name: block.name });
      } else if (block.type === "thinking") {
        outputChannel.appendLine(`  [THINKING START]`);
        // Create new thinking block
        viewProvider.startBlock("thinking");
      }
      // Note: text block will be created on first text delta
    }

    // Handle content block delta
    if (event.type === "content_block_delta" && event.delta) {
      const delta = event.delta;

      // Text delta - main content
      if (delta.text) {
        const text = delta.text;
        outputChannel.appendLine(`  [TEXT] "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`);
        viewProvider.appendToCurrentTextBlock(text);
        return true;
      }

      // Tool input JSON delta
      if (delta.partial_json) {
        currentToolInput += delta.partial_json;
        outputChannel.appendLine(`  [TOOL JSON] "${delta.partial_json.substring(0, 50)}${delta.partial_json.length > 50 ? "..." : ""}"`);
      }

      // Thinking delta
      if (delta.thinking) {
        outputChannel.appendLine(`  [THINKING] "${delta.thinking.substring(0, 50)}${delta.thinking.length > 50 ? "..." : ""}"`);
        viewProvider.appendToThinkingBlock(delta.thinking);
      }
    }

    // Handle content block stop
    if (event.type === "content_block_stop") {
      if (currentToolName) {
        outputChannel.appendLine(`  [TOOL STOP] ${currentToolName}`);
        // Try to parse tool input for display
        try {
          const input = JSON.parse(currentToolInput);
          const displayInfo = getToolDisplayInfo(currentToolName, input);
          viewProvider.updateToolBlock(displayInfo);
        } catch {
          // Ignore parse errors
        }
        // Complete tool block immediately on content_block_stop
        viewProvider.completeToolBlock();
        currentToolName = null;
        currentToolInput = "";
      } else {
        // Complete text or thinking block
        viewProvider.completeCurrentBlock();
      }
    }
  } else if (msg.type === "tool_result") {
    outputChannel.appendLine(`  [TOOL RESULT] id=${msg.tool_use_id}`);
    // Tool already completed on content_block_stop, no action needed
  } else if (msg.type === "assistant") {
    outputChannel.appendLine(`  [SKIP] assistant message (would cause duplicate)`);
    if (msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === "text") {
          outputChannel.appendLine(`    - text block: "${block.text.substring(0, 30)}..."`);
        } else if (block.type === "tool_use") {
          outputChannel.appendLine(`    - tool_use: ${block.name}`);
        }
      }
    }
  } else if (msg.error) {
    outputChannel.appendLine(`  [ERROR] ${msg.error}`);
    viewProvider.setError(msg.error);
  }

  return false;
}

export function deactivate() {}
