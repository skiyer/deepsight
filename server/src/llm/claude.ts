import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

type AgentStreamDelta = {
  text?: string;
  thinking?: string;
  partial_json?: string;
};

type AgentContentBlock = {
  type: "text" | "tool_use" | "thinking" | string;
  id?: string;
  name?: string;
};

type AgentStreamEvent = {
  type: "stream_event";
  event?: {
    type?: string;
    content_block?: AgentContentBlock;
    delta?: AgentStreamDelta;
  };
};

type AgentAssistantMessage = {
  type: "assistant";
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
    }>;
  };
};

type AgentResultMessage = {
  type: "result";
  subtype?: string;
};

type AgentToolResultMessage = {
  type: "tool_result";
  tool_use_id?: string;
};

type AgentSystemMessage = {
  type: "system";
};

type AgentKnownMessageType =
  | "stream_event"
  | "assistant"
  | "result"
  | "tool_result"
  | "system";

type AgentUnknownMessage = {
  type: "unknown";
  raw: unknown;
};

export type AgentMessage =
  | AgentStreamEvent
  | AgentAssistantMessage
  | AgentResultMessage
  | AgentToolResultMessage
  | AgentSystemMessage
  | AgentUnknownMessage;

export interface AgentQueryParams {
  prompt: string;
  cwd: string;
  systemPrompt: string;
  abortController?: AbortController;
}

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
