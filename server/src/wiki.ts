import fs from "node:fs/promises";
import path from "node:path";
import { WIKI_PROMPT } from "./prompts.js";
import { createClaudeQuery } from "./llm/claude.js";
import { hasClaudeCli } from "./runtime/diagnostics.js";
import { isAbortError } from "./runtime/abort.js";

export type WikiEvent =
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

export interface WikiGenerateParams {
  cwd: string;
  scope: { include: string[]; exclude: string[] };
  pages?: string[];
  sensitivePaths?: string[];
  limits?: { maxFilesRead?: number; maxBytesRead?: number };
}

const HOME_PAGE = "Home.md";
const DEGRADED_PAGES = [HOME_PAGE, "TrustBoundaries.md", "AttackSurface.md"];
const ROOT_ENTRY_LIMIT = 60;
const QUICK_CONTEXT_PREVIEW_LINES = 40;
const QUICK_CONTEXT_FILES = [
  "README.md",
  "README.MD",
  "README.txt",
  "package.json",
  "server/package.json",
  "extension/package.json",
  "server/src/index.ts",
  "extension/src/extension.ts",
  "extension/src/webview.ts",
];

const PAGE_DEFINITIONS: Record<string, { title: string; outline: string }> = {
  [HOME_PAGE]: {
    title: "主页",
    outline: "Summary / Tech Stack / Entrypoints / Core Modules / Security Focus",
  },
  "Architecture.md": {
    title: "系统架构",
    outline: "技术栈与依赖 / 部署运行形态 / 核心组件职责 / 数据存储与状态",
  },
  "Modules.md": {
    title: "模块",
    outline: "模块划分原则 / 模块清单 / 依赖关系",
  },
  "Dataflow.md": {
    title: "数据流",
    outline: "关键数据对象 / 关键数据流 / 安全相关 Sink",
  },
  "TrustBoundaries.md": {
    title: "信任边界",
    outline: "信任边界图 / 输入入口 / 权限模型 / 外部依赖",
  },
  "AttackSurface.md": {
    title: "攻击面",
    outline: "入口 / 文件与内容处理 / 网络通信 / 高风险点",
  },
};

const DEFAULT_PAGES = Object.keys(PAGE_DEFINITIONS);

const WIKI_GENERATION_ABORTED = "WIKI_GENERATION_ABORTED";

const createAbortError = () => {
  const error = new Error(WIKI_GENERATION_ABORTED);
  error.name = "AbortError";
  return error;
};

const throwIfAborted = (abortController: AbortController) => {
  if (abortController.signal.aborted) {
    throw createAbortError();
  }
};


function normalizePath(input: string): string {
  return input.replace(/\\/g, "/");
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const withStars = escaped.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
  return new RegExp(`^${withStars}$`);
}

function matchesPattern(normalizedPath: string, pattern: string): boolean {
  const regex = patternToRegex(pattern);
  if (regex.test(normalizedPath)) return true;
  const withLeadingSlash = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;
  return regex.test(withLeadingSlash);
}

function isExcludedPath(targetPath: string, excludePatterns: string[]): boolean {
  const normalized = normalizePath(targetPath);
  return excludePatterns.some((pattern) => matchesPattern(normalized, pattern));
}

function isSensitivePath(targetPath: string, sensitivePaths: string[]): boolean {
  const normalized = normalizePath(targetPath);
  const base = normalized.split("/").pop() || normalized;
  return sensitivePaths.some((pattern) => matchesPattern(normalized, pattern) || matchesPattern(base, pattern));
}

function splitFrontMatter(markdown: string): { frontMatter: string; body: string } {
  if (!markdown.startsWith("---")) return { frontMatter: "", body: markdown };
  const lines = markdown.split("\n");
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return { frontMatter: "", body: markdown };
  return {
    frontMatter: lines.slice(1, end).join("\n").trim(),
    body: lines.slice(end + 1).join("\n").replace(/^\n+/, ""),
  };
}

function extractConfidence(markdown: string): "low" | "medium" | "high" {
  const match = markdown.match(/confidence\s*[:：]\s*(low|medium|high)/i);
  if (match?.[1]) return match[1].toLowerCase() as "low" | "medium" | "high";
  return "medium";
}

function extractBlindSpots(markdown: string): string[] | undefined {
  const match = markdown.match(/blindSpots?\s*[:：]\s*\[([^\]]*)\]/i);
  if (!match?.[1]) return undefined;
  const raw = match[1].split(",").map((v) => v.trim()).filter(Boolean);
  return raw.length ? raw : undefined;
}

async function readFileSafe(
  filePath: string,
  state: { filesRead: number; bytesRead: number; limitExceeded: boolean },
  limits: { maxFilesRead: number; maxBytesRead: number }
): Promise<string | null> {
  if (state.limitExceeded) return null;
  if (state.filesRead >= limits.maxFilesRead || state.bytesRead >= limits.maxBytesRead) {
    state.limitExceeded = true;
    return null;
  }
  const content = await fs.readFile(filePath, "utf-8");
  state.filesRead += 1;
  state.bytesRead += Buffer.byteLength(content, "utf-8");
  if (state.filesRead >= limits.maxFilesRead || state.bytesRead >= limits.maxBytesRead) {
    state.limitExceeded = true;
  }
  return content;
}

async function collectQuickContext(params: WikiGenerateParams): Promise<{
  manifest: string;
  evidenceNotes: string;
  homeMissing: boolean;
  limitExceeded: boolean;
}> {
  const cwd = params.cwd;
  const exclude = params.scope.exclude;
  const sensitivePaths = params.sensitivePaths || [];
  const limits = {
    maxFilesRead: params.limits?.maxFilesRead ?? 400,
    maxBytesRead: params.limits?.maxBytesRead ?? 2 * 1024 * 1024,
  };

  const state = { filesRead: 0, bytesRead: 0, limitExceeded: false };
  const snippets: string[] = [];

  const homePath = path.join(cwd, ".deepsight", "wiki", HOME_PAGE);
  let homeMissing = true;
  let manifest = "";

  try {
    const homeContent = await readFileSafe(homePath, state, limits);
    if (homeContent) {
      const { body } = splitFrontMatter(homeContent);
      const nonEmptyLineCount = body
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean).length;
      if (nonEmptyLineCount >= 40) {
        manifest = body.trim();
        homeMissing = false;
      }
    }
  } catch {
    // ignore
  }

  const rootEntries = await fs.readdir(cwd, { withFileTypes: true });
  const topLevel = rootEntries.map((entry) => entry.name).slice(0, ROOT_ENTRY_LIMIT);
  snippets.push(`Workspace entries: ${topLevel.join(", ")}`);

  for (const relPath of QUICK_CONTEXT_FILES) {
    const fullPath = path.join(cwd, relPath);
    if (isExcludedPath(fullPath, exclude)) continue;
    if (isSensitivePath(fullPath, sensitivePaths)) continue;
    try {
      const content = await readFileSafe(fullPath, state, limits);
      if (!content) continue;
      const preview = content.split("\n").slice(0, QUICK_CONTEXT_PREVIEW_LINES).join("\n");
      snippets.push(`File: ${relPath}\n${preview}`);
    } catch {
      // ignore
    }
  }

  if (!manifest) {
    manifest = `该项目用于安全审计的系统 Wiki。当前未提供 ${HOME_PAGE}。\n\n${snippets.join("\n\n")}`;
  }

  const evidenceNotes = snippets.join("\n\n");
  return { manifest, evidenceNotes, homeMissing, limitExceeded: state.limitExceeded };
}

function filterSensitiveNotes(notes: string, sensitivePaths: string[]): string {
  if (!sensitivePaths.length) return notes;
  const lines = notes.split("\n");
  const filtered = lines.filter((line) => {
    if (!line.startsWith("File:")) return true;
    const filePath = line.slice(5).trim();
    return !isSensitivePath(filePath, sensitivePaths);
  });
  return filtered.join("\n");
}

function buildUserPrompt(params: {
  page: string;
  manifest: string;
  outline: string;
  evidence: string;
  extraNotes?: string;
}): string {
  return [
    `你正在生成页面：${params.page}`,
    "",
    `## Manifest (${HOME_PAGE})`,
    params.manifest,
    "",
    "## Page Outline",
    params.outline,
    "",
    "## Evidence Notes",
    params.evidence,
    params.extraNotes ? `\n## Notes\n${params.extraNotes}` : "",
    "",
    "请严格按该页面模板输出 Markdown，并包含 Evidence。",
  ].join("\n");
}

async function generateMarkdown(
  prompt: string,
  cwd: string,
  abortController: AbortController
): Promise<string> {
  try {
    const q = createClaudeQuery({
      prompt,
      cwd,
      systemPrompt: WIKI_PROMPT,
      abortController,
    });

    let output = "";
    for await (const msg of q) {
      throwIfAborted(abortController);

      if (msg.type === "stream_event" && msg.event?.type === "content_block_delta") {
        const delta = (msg.event as any).delta;
        if (delta?.text) {
          output += delta.text;
        }
      } else if (msg.type === "assistant") {
        // ignore to avoid duplicate
      } else if (msg.type === "result" && msg.subtype !== "success") {
        throw new Error(`Model error: ${msg.subtype}`);
      }
    }

    throwIfAborted(abortController);

    return output.trim();
  } catch (error) {
    if (isAbortError(error, abortController)) {
      throw createAbortError();
    }

    const err = error as { message?: string; stack?: string; code?: string; stderr?: string };
    const details = [
      err.message || "Unknown error",
      err.code ? `code=${err.code}` : "",
      err.stderr ? `stderr=${err.stderr}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    console.error("[wiki] generateMarkdown failed:", err);
    throw new Error(details || "Wiki generation failed");
  }
}

export async function* generateWikiEvents(
  params: WikiGenerateParams,
  options?: { abortController?: AbortController }
): AsyncGenerator<WikiEvent> {
  const abortController = options?.abortController ?? new AbortController();

  try {
    if (!process.env.ANTHROPIC_AUTH_TOKEN) {
      yield { type: "error", code: "MISSING_TOKEN", message: "ANTHROPIC_AUTH_TOKEN is not set" };
      return;
    }
    if (!hasClaudeCli()) {
      yield { type: "error", code: "MISSING_CLAUDE_CLI", message: "Claude CLI not found in PATH" };
      return;
    }

    throwIfAborted(abortController);

    const cwd = params.cwd;
    const pages = Array.isArray(params.pages) && params.pages.length ? params.pages : DEFAULT_PAGES;

    yield { type: "progress", phase: "scanning", pct: 5, message: "Scanning workspace" };

    const context = await collectQuickContext(params);
    throwIfAborted(abortController);

    const safeEvidence = filterSensitiveNotes(context.evidenceNotes, params.sensitivePaths || []);
    const degrade = context.limitExceeded;
    const targetPages = degrade ? DEGRADED_PAGES : pages;

    yield {
      type: "progress",
      phase: "drafting",
      pct: 20,
      message: degrade ? "Large repo detected, using degraded plan" : "Planning pages",
    };

    let manifest = context.manifest;

    if (context.homeMissing) {
      throwIfAborted(abortController);
      const prompt = buildUserPrompt({
        page: HOME_PAGE,
        manifest: context.manifest,
        outline: PAGE_DEFINITIONS[HOME_PAGE]?.outline ?? "",
        evidence: safeEvidence,
        extraNotes: `${HOME_PAGE} 缺失，请先生成 Manifest。`,
      });
      const markdown = await generateMarkdown(prompt, cwd, abortController);
      throwIfAborted(abortController);

      const confidence = extractConfidence(markdown);
      const blindSpots = extractBlindSpots(markdown);
      manifest = markdown;
      yield {
        type: "page",
        path: HOME_PAGE,
        title: PAGE_DEFINITIONS[HOME_PAGE]?.title ?? "Home",
        confidence,
        markdown,
        blindSpots,
      };
    }

    let pct = 35;
    const perPage = Math.max(1, Math.floor(60 / Math.max(1, targetPages.length)));

    for (const page of targetPages) {
      if (page === HOME_PAGE) continue;
      throwIfAborted(abortController);
      yield { type: "progress", phase: "drafting", pct, page, message: `Drafting ${page}` };

      const outline = PAGE_DEFINITIONS[page]?.outline ?? "";
      const prompt = buildUserPrompt({
        page,
        manifest,
        outline,
        evidence: safeEvidence,
        extraNotes: degrade ? "仓库规模较大，允许低置信度并列出盲区。" : undefined,
      });
      const markdown = await generateMarkdown(prompt, cwd, abortController);
      throwIfAborted(abortController);

      const confidence = extractConfidence(markdown);
      const blindSpots = extractBlindSpots(markdown);
      yield {
        type: "page",
        path: page,
        title: PAGE_DEFINITIONS[page]?.title ?? page.replace(/\.md$/i, ""),
        confidence,
        markdown,
        blindSpots,
      };
      pct = Math.min(90, pct + perPage);
    }

    throwIfAborted(abortController);
    yield { type: "progress", phase: "writing", pct: 95, message: "Finalizing" };
    yield { type: "done" };
  } catch (error) {
    if (isAbortError(error, abortController)) {
      // Client cancelled / stream aborted. Stop silently.
      return;
    }
    throw error;
  }
}

