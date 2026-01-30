import { execSync } from "node:child_process";

const safeExec = (command: string): string | null => {
  try {
    return execSync(command, { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
};

export const getClaudeCliPath = (): string | null => safeExec("which claude");

export const hasClaudeCli = (): boolean => Boolean(getClaudeCliPath());
