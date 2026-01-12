import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { EXPLAIN_PROMPT, AUDIT_PROMPT } from "./prompts.js";
import { execSync } from "child_process";

export interface AnalyzeParams {
  file: string;
  code: string;
  line: number;
  mode: "explain" | "audit";
  cwd: string;
}

// Check if running in WSL
const isWSL = process.platform === "linux" &&
  process.env.WSL_DISTRO_NAME !== undefined;

/**
 * Convert Windows path to WSL path
 * e.g., "d:\MyWorks\project" -> "/mnt/d/MyWorks/project"
 */
function toWSLPath(windowsPath: string): string {
  // Check if it's a Windows path (contains backslash or drive letter)
  if (/^[a-zA-Z]:/.test(windowsPath)) {
    const driveLetter = windowsPath[0].toLowerCase();
    const rest = windowsPath.slice(2).replace(/\\/g, "/");
    return `/mnt/${driveLetter}${rest}`;
  }
  // Already a Unix path or relative path
  return windowsPath.replace(/\\/g, "/");
}

// Debug: Log environment info on startup
function logEnvironmentInfo() {
  console.log("=== DeepSight Agent Environment Debug ===");
  console.log("Platform:", process.platform);
  console.log("Is WSL:", isWSL);
  console.log("WSL_DISTRO_NAME:", process.env.WSL_DISTRO_NAME);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("ANTHROPIC_AUTH_TOKEN:", process.env.ANTHROPIC_AUTH_TOKEN ? "***set***" : "NOT SET");
  console.log("ANTHROPIC_BASE_URL:", process.env.ANTHROPIC_BASE_URL || "NOT SET");
  console.log("PATH:", process.env.PATH);

  try {
    const nodeVersion = execSync("node --version", { encoding: "utf-8" }).trim();
    const nodePath = execSync("which node", { encoding: "utf-8" }).trim();
    console.log("Node version:", nodeVersion);
    console.log("Node path:", nodePath);
  } catch (e) {
    console.error("Failed to get node info:", e);
  }

  try {
    const claudePath = execSync("which claude", { encoding: "utf-8" }).trim();
    console.log("Claude CLI path:", claudePath);
  } catch (e) {
    console.log("Claude CLI not found in PATH");
  }

  console.log("=========================================");
}

// Log on module load
logEnvironmentInfo();

export async function* analyze(params: AnalyzeParams): AsyncGenerator<SDKMessage> {
  // Convert paths if running in WSL
  let cwd = params.cwd;
  let file = params.file;

  if (isWSL) {
    cwd = toWSLPath(params.cwd);
    file = toWSLPath(params.file);
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

  const systemPrompt = params.mode === "explain" ? EXPLAIN_PROMPT : AUDIT_PROMPT;

  const userPrompt = `请分析以下代码（文件：${file}，焦点行：${params.line}）：

\`\`\`
${params.code}
\`\`\`

${params.mode === "explain" ? "请解释这段代码的功能和数据流。" : "请对这段代码进行安全审计。"}`;

  // 调试日志：显示完整的prompt输入
  const DEBUG_PROMPT = process.env.DEBUG_PROMPT === "true";
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
    const q = query({
      prompt: userPrompt,
      options: {
        cwd,
        systemPrompt,
	allowedTools: ["Read", "Glob"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        executable: "node",
        env: process.env as Record<string, string>,
        stderr: (data: string) => {
          console.error("[SDK stderr]:", data);
        },
      },
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
