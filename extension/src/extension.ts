import * as vscode from "vscode";
import { DeepSightCodeLensProvider } from "./codelens";
import { DeepSightViewProvider } from "./webview";

// Debug output channel
let outputChannel: vscode.OutputChannel;

let viewProvider: DeepSightViewProvider;

export function activate(context: vscode.ExtensionContext) {
  // Create output channel for debugging
  outputChannel = vscode.window.createOutputChannel("DeepSight Debug");
  outputChannel.appendLine("DeepSight extension activated");

  console.log("DeepSight extension activated");

  // Register CodeLens provider
  const codeLensProvider = new DeepSightCodeLensProvider();
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    [
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
    explainCommand,
    auditCommand,
    showDebugCommand,
    outputChannel
  );
}

async function analyzeCode(
  document: vscode.TextDocument,
  line: number,
  mode: "explain" | "audit"
) {
  const config = vscode.workspace.getConfiguration("deepsight");
  const serverUrl = config.get<string>("serverUrl", "http://localhost:3000");

  const filePath = document.uri.fsPath;
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const code = document.getText();
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const cwd = workspaceFolder?.uri.fsPath || filePath.replace(/[/\\][^/\\]+$/, "");

  // Get symbol name at line for display
  const lineText = document.lineAt(line).text;
  const symbolMatch = lineText.match(/(?:function|class|def|fn|struct|impl)\s+(\w+)|(?:const|let|var)\s+(\w+)/);
  const anchor = symbolMatch ? (symbolMatch[1] || symbolMatch[2]) : `Line ${line + 1}`;

  outputChannel.appendLine(`\n${"=".repeat(50)}`);
  outputChannel.appendLine(`[${new Date().toISOString()}] Starting analysis`);
  outputChannel.appendLine(`  File: ${filePath}`);
  outputChannel.appendLine(`  Line: ${line + 1}`);
  outputChannel.appendLine(`  Mode: ${mode}`);
  outputChannel.appendLine(`  Anchor: ${anchor}`);

  // Focus the DeepSight view first (webview 重建时会自动恢复状态)
  await vscode.commands.executeCommand("deepsight.resultView.focus");

  // Set loading state immediately
  viewProvider.setLoading(`${fileName}:${anchor}`, mode);

  try {
    const response = await fetch(`${serverUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: filePath,
        code,
        line: line + 1, // 1-indexed
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
  }
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

function getToolDisplayInfo(toolName: string, input: any): string {
  switch (toolName) {
    case "Read":
      return input.file_path ? `📄 ${input.file_path.split(/[/\\]/).pop()}` : "";
    case "Glob":
      return input.pattern ? `🔍 ${input.pattern}` : "";
    case "Grep":
      return input.pattern ? `🔎 "${input.pattern}"` : "";
    case "Bash":
      return input.command ? `$ ${input.command.substring(0, 40)}${input.command.length > 40 ? "..." : ""}` : "";
    case "Write":
      return input.file_path ? `✏️ ${input.file_path.split(/[/\\]/).pop()}` : "";
    case "Edit":
      return input.file_path ? `✂️ ${input.file_path.split(/[/\\]/).pop()}` : "";
    default:
      return "";
  }
}

export function deactivate() {
  console.log("DeepSight extension deactivated");
}
