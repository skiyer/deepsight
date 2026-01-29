import { Hono } from "hono";
import { z } from "zod";
import type { AgentMessage } from "../llm/types.js";
import { analyze } from "../agent.js";
import { parseJson } from "./validate.js";
import { streamSseEvents } from "./sse.js";

const analyzeRouter = new Hono();

const AnalyzeRequestSchema = z.object({
  file: z.string(),
  line: z.number(),
  lineText: z.string(),
  mode: z.enum(["explain", "audit"]),
  cwd: z.string(),
});

type AnalyzeSseEvent = { event: string; data: AgentMessage };

const toAnalyzeEvent = (msg: AgentMessage): AnalyzeSseEvent | null => {
  if (msg.type === "stream_event") {
    return { event: "chunk", data: msg };
  }
  if (msg.type === "assistant") {
    return { event: "message", data: msg };
  }
  if (msg.type === "result") {
    const event = msg.subtype === "success" ? "done" : "error";
    return { event, data: msg };
  }
  if (msg.type === "system") {
    return { event: "system", data: msg };
  }
  return null;
};

analyzeRouter.post("/", async (c) => {
  const parsed = await parseJson(c, AnalyzeRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const params = parsed.data;

  return streamSseEvents(c, {
    createStream: (abortController) => analyze(params, { abortController }),
    toEvent: toAnalyzeEvent,
    onError: (error) => ({
      event: "error",
      data: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    }),
  });
});

export { analyzeRouter };
