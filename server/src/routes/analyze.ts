import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { analyze } from "../agent.js";
import { parseJson } from "./validate.js";

const analyzeRouter = new Hono();

const AnalyzeRequestSchema = z.object({
  file: z.string(),
  line: z.number(),
  lineText: z.string(),
  mode: z.enum(["explain", "audit"]),
  cwd: z.string(),
});

type AnalyzeSseEvent = { event: string; data: SDKMessage };

const toAnalyzeEvent = (msg: SDKMessage): AnalyzeSseEvent | null => {
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

  return streamSSE(c, async (stream) => {
    try {
      for await (const msg of analyze(params)) {
        const event = toAnalyzeEvent(msg);
        if (!event) continue;
        await stream.writeSSE({
          event: event.event,
          data: JSON.stringify(event.data),
        });
      }
    } catch (error) {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      });
    }
  });
});

export { analyzeRouter };
