import { execSync } from "node:child_process";
import { isWsl } from "./paths.js";

const safeExec = (command: string): string | null => {
  try {
    return execSync(command, { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
};

export const getClaudeCliPath = (): string | null => safeExec("which claude");

export const hasClaudeCli = (): boolean => Boolean(getClaudeCliPath());

export const logAgentEnvironment = (): void => {
  console.log("=== DeepSight Agent Environment Debug ===");
  console.log("Platform:", process.platform);
  console.log("Is WSL:", isWsl);
  console.log("WSL_DISTRO_NAME:", process.env.WSL_DISTRO_NAME);
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log(
    "ANTHROPIC_AUTH_TOKEN:",
    process.env.ANTHROPIC_AUTH_TOKEN ? "***set***" : "NOT SET"
  );
  console.log("ANTHROPIC_BASE_URL:", process.env.ANTHROPIC_BASE_URL || "NOT SET");
  console.log("DEBUG_PROMPT:", process.env.DEBUG_PROMPT === "true" ? "ENABLED" : "disabled");
  console.log("Node version:", process.version);
  console.log("Node path:", process.execPath);

  const claudePath = getClaudeCliPath();
  if (claudePath) {
    console.log("Claude CLI path:", claudePath);
  } else {
    console.log("Claude CLI not found in PATH");
  }

  console.log("=========================================");
};
