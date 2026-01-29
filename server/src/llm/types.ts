export type AgentStreamDelta = {
  text?: string;
  thinking?: string;
  partial_json?: string;
};

export type AgentContentBlock = {
  type: "text" | "tool_use" | "thinking" | string;
  id?: string;
  name?: string;
};

export type AgentStreamEvent = {
  type: "stream_event";
  event?: {
    type?: string;
    content_block?: AgentContentBlock;
    delta?: AgentStreamDelta;
  };
};

export type AgentAssistantMessage = {
  type: "assistant";
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
    }>;
  };
};

export type AgentResultMessage = {
  type: "result";
  subtype?: string;
};

export type AgentToolResultMessage = {
  type: "tool_result";
  tool_use_id?: string;
};

export type AgentSystemMessage = {
  type: "system";
};

export type AgentKnownMessageType =
  | "stream_event"
  | "assistant"
  | "result"
  | "tool_result"
  | "system";

export type AgentUnknownMessage = {
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

export type AgentQuery = (params: AgentQueryParams) => AsyncGenerator<AgentMessage>;
