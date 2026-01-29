import { query } from "@anthropic-ai/claude-agent-sdk";

const ALLOWED_TOOLS = ["Read", "Glob"] as const;
const SDK_ENV = process.env as Record<string, string>;

const BASE_OPTIONS = {
  allowedTools: ALLOWED_TOOLS,
  permissionMode: "bypassPermissions" as const,
  allowDangerouslySkipPermissions: true,
  includePartialMessages: true,
  executable: "node",
  env: SDK_ENV,
  stderr: (data: string) => {
    console.error("[SDK stderr]:", data);
  },
};

export function createSdkQuery(params: {
  prompt: string;
  cwd: string;
  systemPrompt: string;
  abortController?: AbortController;
}) {
  const options = {
    ...BASE_OPTIONS,
    cwd: params.cwd,
    systemPrompt: params.systemPrompt,
    ...(params.abortController ? { abortController: params.abortController } : {}),
  };

  return query({
    prompt: params.prompt,
    options,
  });
}
