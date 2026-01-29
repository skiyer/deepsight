import { EXPLAIN_PROMPT, AUDIT_PROMPT } from "./prompts.js";
import { createAgentQuery } from "./llm/client.js";
import type { AgentMessage } from "./llm/types.js";
import { resolveWorkspacePaths } from "./runtime/paths.js";

export interface AnalyzeParams {
  file: string;
  line: number;
  lineText: string;
  mode: "explain" | "audit";
  cwd: string;
}

const DEBUG_PROMPT = process.env.DEBUG_PROMPT === "true";

const SYSTEM_PROMPTS = {
  explain: EXPLAIN_PROMPT,
  audit: AUDIT_PROMPT,
} as const;

const MODE_INSTRUCTIONS = {
  explain: "请解释这段代码的功能和数据流。",
  audit: "请对这段代码进行安全审计。",
} as const;

function buildUserPrompt(params: {
  file: string;
  line: number;
  focusLine: string;
  mode: AnalyzeParams["mode"];
}): string {
  return `请分析以下代码（文件：${params.file}，焦点行：${params.line}）：

\`\`\`
${params.focusLine}
\`\`\`

${MODE_INSTRUCTIONS[params.mode]}`;
}

export async function* analyze(params: AnalyzeParams): AsyncGenerator<AgentMessage> {
  // Convert paths if running in WSL
  const resolvedPaths = resolveWorkspacePaths({ cwd: params.cwd, file: params.file });
  const { cwd, file } = resolvedPaths;

  if (resolvedPaths.converted) {
    console.log("[analyze] WSL path conversion:");
    console.log("  cwd:", params.cwd, "->", cwd);
    console.log("  file:", params.file, "->", file);
  }

  console.log("[analyze] Starting analysis:", {
    file,
    line: params.line,
    mode: params.mode,
    cwd,
  });

  const systemPrompt = SYSTEM_PROMPTS[params.mode];

  const focusLineCode = params.lineText.trim() || "[无法获取焦点行代码]";

  const userPrompt = buildUserPrompt({
    file,
    line: params.line,
    focusLine: focusLineCode,
    mode: params.mode,
  });

  // 调试日志：显示完整的prompt输入
  if (DEBUG_PROMPT) {
    console.log("=".repeat(80));
    console.log("[PROMPT DEBUG] System Prompt:");
    console.log("=".repeat(80));
    console.log(systemPrompt);
    console.log("=".repeat(80));

    console.log("\n" + "=".repeat(80));
    console.log("[PROMPT DEBUG] User Prompt:");
    console.log("=".repeat(80));
    console.log(userPrompt);
    console.log("=".repeat(80));

    console.log(`\n[PROMPT DEBUG] Stats: System=${systemPrompt.length} chars, User=${userPrompt.length} chars, Total=${systemPrompt.length + userPrompt.length} chars`);
    console.log("=".repeat(80) + "\n");
  }

  console.log("[analyze] Creating query with options:", {
    cwd,
    executable: "node",
    permissionMode: "bypassPermissions",
    includePartialMessages: true,
  });

  try {
    const q = createAgentQuery({
      prompt: userPrompt,
      cwd,
      systemPrompt,
    });

    console.log("[analyze] Query created, starting iteration...");

    let messageCount = 0;
    for await (const msg of q) {
      messageCount++;
      console.log(`[analyze] Message #${messageCount}:`, msg.type,
        msg.type === "result" ? `(subtype: ${(msg as any).subtype})` : "");
      yield msg;
    }

    console.log(`[analyze] Completed. Total messages: ${messageCount}`);
  } catch (error) {
    console.error("[analyze] Error during query:", error);
    throw error;
  }
}
