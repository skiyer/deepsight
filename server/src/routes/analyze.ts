import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
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

analyzeRouter.post("/", async (c) => {
  const parsed = await parseJson(c, AnalyzeRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const params = parsed.data;

  return streamSSE(c, async (stream) => {
    try {
      for await (const msg of analyze(params)) {
        if (msg.type === "stream_event") {
          // Partial message for typewriter effect
          await stream.writeSSE({
            event: "chunk",
            data: JSON.stringify(msg),
          });
        } else if (msg.type === "assistant") {
          // Complete assistant message
          await stream.writeSSE({
            event: "message",
            data: JSON.stringify(msg),
          });
        } else if (msg.type === "result") {
          // Final result
          const event = msg.subtype === "success" ? "done" : "error";
          await stream.writeSSE({
            event,
            data: JSON.stringify(msg),
          });
        } else if (msg.type === "system") {
          // System init message
          await stream.writeSSE({
            event: "system",
            data: JSON.stringify(msg),
          });
        }
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
