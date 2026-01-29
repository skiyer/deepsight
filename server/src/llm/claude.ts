import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentKnownMessageType, AgentMessage, AgentQueryParams } from "./types.js";

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

const KNOWN_MESSAGE_TYPES: AgentKnownMessageType[] = [
  "stream_event",
  "assistant",
  "result",
  "tool_result",
  "system",
];

const isKnownMessageType = (type?: string): type is AgentKnownMessageType =>
  typeof type === "string" && KNOWN_MESSAGE_TYPES.includes(type as AgentKnownMessageType);

const toAgentMessage = (message: SDKMessage): AgentMessage => {
  const messageType = (message as { type?: string }).type;
  if (isKnownMessageType(messageType)) {
    return message as AgentMessage;
  }
  return { type: "unknown", raw: message };
};

async function* mapSdkMessages(stream: AsyncGenerator<SDKMessage>): AsyncGenerator<AgentMessage> {
  for await (const msg of stream) {
    yield toAgentMessage(msg);
  }
}

export function createClaudeQuery(params: AgentQueryParams): AsyncGenerator<AgentMessage> {
  const options = {
    ...BASE_OPTIONS,
    cwd: params.cwd,
    systemPrompt: params.systemPrompt,
    ...(params.abortController ? { abortController: params.abortController } : {}),
  };

  const stream = query({
    prompt: params.prompt,
    options,
  });

  return mapSdkMessages(stream);
}
