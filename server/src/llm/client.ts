import type { AgentMessage, AgentQueryParams } from "./types.js";
import { createClaudeQuery } from "./claude.js";

export interface AgentClient {
  query(params: AgentQueryParams): AsyncGenerator<AgentMessage>;
}

const DEFAULT_PROVIDER = "claude" as const;

const providers: Record<string, AgentClient> = {
  claude: {
    query: (params: AgentQueryParams) => createClaudeQuery(params),
  },
};

export function getAgentClient(providerName = process.env.DEEPSIGHT_LLM_PROVIDER): AgentClient {
  const key = providerName?.trim() || DEFAULT_PROVIDER;
  return providers[key] ?? providers[DEFAULT_PROVIDER];
}

export function createAgentQuery(params: AgentQueryParams): AsyncGenerator<AgentMessage> {
  return getAgentClient().query(params);
}
