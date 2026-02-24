import { type Dirent, type Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_WORKSPACE = "/workspace";
const DEFAULT_PORT = 3000;

const DOC_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".docx", ".pptx"]);
const BINARY_EXTENSIONS = new Set([".docx", ".pptx"]);
const SCAN_EXCLUDE_DIRS = new Set([".git", "node_modules", "reports", ".deepsight"]);
const SERVER_EXCLUDES = [".git/**", "node_modules/**", "reports/**"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MARKITDOWN_SCRIPT = path.resolve(__dirname, "../scripts/markitdown_convert.py");

const toPosix = (value: string) => value.split(path.sep).join("/");

const getWorkspace = () => process.env.DEEPSIGHT_WORKSPACE ?? DEFAULT_WORKSPACE;

const getServerUrl = () => {
  if (process.env.DEEPSIGHT_SERVER_URL) return process.env.DEEPSIGHT_SERVER_URL;
  const port = Number.parseInt(process.env.DEEPSIGHT_PORT ?? String(DEFAULT_PORT), 10);
  const resolvedPort = Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;
  return `http://127.0.0.1:${resolvedPort}`;
};

const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const shouldSkipDir = (dirName: string) => SCAN_EXCLUDE_DIRS.has(dirName);

export async function scanDocuments(root: string): Promise<string[]> {
  const docs: string[] = [];
  const queue: string[] = [root];

  while (queue.length) {
    const current = queue.pop();
    if (!current) continue;

    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      console.warn(`[scan] Skip ${current}: ${String(error)}`);
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue;
        queue.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!DOC_EXTENSIONS.has(ext)) continue;

      const relPath = toPosix(path.relative(root, fullPath));
      docs.push(relPath);
    }
  }

  docs.sort((a, b) => {
    const aKey = a.toLowerCase();
    const bKey = b.toLowerCase();
    if (aKey < bKey) return -1;
    if (aKey > bKey) return 1;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
  return docs;
}

export async function convertWithMarkitdown(
  sourcePath: string,
  outputPath: string
): Promise<{ status: "converted" | "cached" | "failed"; error?: string }> {
  let sourceStat: Stats;
  try {
    sourceStat = await fs.stat(sourcePath);
  } catch (error) {
    return { status: "failed", error: `stat failed: ${String(error)}` };
  }

  try {
    const outputStat = await fs.stat(outputPath);
    if (outputStat.mtimeMs >= sourceStat.mtimeMs) {
      return { status: "cached" };
    }
  } catch {
    // ignore missing output
  }

  try {
    await ensureDir(path.dirname(outputPath));
    const python = process.env.MARKITDOWN_PYTHON ?? "python3";
    await execFileAsync(python, [MARKITDOWN_SCRIPT, sourcePath, outputPath], {
      env: process.env as NodeJS.ProcessEnv,
    });
    return { status: "converted" };
  } catch (error) {
    return { status: "failed", error: `markitdown failed: ${String(error)}` };
  }
}

export async function waitForServer(baseUrl: string, retries = 40, delayMs = 500) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(baseUrl, { method: "GET" });
      if (response) return;
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Server not ready at ${baseUrl}`);
}

export type SseEvent = { event: string; data: string };

export function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (!dataLines.length) return null;
  return { event, data: dataLines.join("\n") };
}

export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => Promise<void>
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const event = parseSseBlock(part.trim());
      if (event) await onEvent(event);
    }
  }

  if (buffer.trim()) {
    const event = parseSseBlock(buffer.trim());
    if (event) await onEvent(event);
  }
}

export async function generateWikiReports(
  baseUrl: string,
  workspace: string,
  reportsDir: string
) {
  const payload = {
    cwd: workspace,
    scope: {
      include: ["**/*"],
      exclude: SERVER_EXCLUDES,
    },
  };

  const response = await fetch(`${baseUrl}/wiki/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("Server response has no body");
  }

  await readSseStream(response.body, async (event) => {
    if (event.event === "progress") {
      const data = JSON.parse(event.data) as { pct?: number; message?: string; page?: string };
      const detail = data.page ? `${data.page}` : data.message ?? "";
      console.log(`[progress] ${data.pct ?? 0}% ${detail}`.trim());
      return;
    }

    if (event.event === "page") {
      const data = JSON.parse(event.data) as { path: string; markdown: string };
      const outputPath = path.join(reportsDir, data.path);
      await ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, data.markdown, "utf-8");
      console.log(`[page] ${data.path}`);
      return;
    }

    if (event.event === "error") {
      const data = JSON.parse(event.data) as { message?: string; code?: string };
      throw new Error(`Wiki generation failed: ${data.code ?? "ERROR"} ${data.message ?? ""}`);
    }

    if (event.event === "done") {
      console.log("[done] Wiki generation complete");
    }
  });
}

export async function runCli() {
  const workspace = getWorkspace();
  const serverUrl = getServerUrl();
  const reportsDir = path.join(workspace, "reports");
  const docsCacheDir = path.join(workspace, ".deepsight", "docs-cache");

  if (!process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("ANTHROPIC_AUTH_TOKEN is not set");
  }

  try {
    const workspaceStat = await fs.stat(workspace);
    if (!workspaceStat.isDirectory()) {
      throw new Error("not a directory");
    }
  } catch {
    throw new Error(`Workspace not found: ${workspace}`);
  }

  await ensureDir(docsCacheDir);
  await ensureDir(reportsDir);

  console.log(`[scan] Workspace: ${workspace}`);
  const docs = await scanDocuments(workspace);
  console.log(`[scan] Found ${docs.length} documents`);

  let converted = 0;
  let cached = 0;
  let failed = 0;

  for (const docPath of docs) {
    const ext = path.extname(docPath).toLowerCase();
    if (!BINARY_EXTENSIONS.has(ext)) continue;

    const sourcePath = path.join(workspace, docPath);
    const outputPath = path.join(docsCacheDir, `${docPath}.md`);
    const result = await convertWithMarkitdown(sourcePath, outputPath);

    if (result.status === "converted") converted += 1;
    if (result.status === "cached") cached += 1;
    if (result.status === "failed") failed += 1;
  }

  console.log(`[convert] converted=${converted} cached=${cached} failed=${failed}`);

  await waitForServer(serverUrl);
  await generateWikiReports(serverUrl, workspace, reportsDir);
}
