import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { generateWikiEvents } from "../wiki.js";
import { parseJson } from "./validate.js";

const wikiRouter = new Hono();

const WikiGenerateRequestSchema = z.object({
  cwd: z.string(),
  scope: z.object({
    include: z.array(z.string()),
    exclude: z.array(z.string()),
  }),
  pages: z.array(z.string()).optional(),
  sensitivePaths: z.array(z.string()).optional(),
  limits: z
    .object({
      maxFilesRead: z.number().int().positive().optional(),
      maxBytesRead: z.number().int().positive().optional(),
    })
    .optional(),
});

wikiRouter.post("/generate", async (c) => {
  const parsed = await parseJson(c, WikiGenerateRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const params = parsed.data;

  return streamSSE(c, async (stream) => {
    const abortController = new AbortController();
    const { signal } = abortController;

    const abort = () => {
      if (!signal.aborted) {
        abortController.abort();
      }
    };

    const sendEvent = (event: { type: string }) => {
      return stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    };

    // Abort generation when client disconnects / cancels the SSE stream
    stream.onAbort(abort);

    // Also attempt to bind to Request abort (runtime dependent)
    c.req.raw.signal.addEventListener("abort", abort);

    try {
      for await (const evt of generateWikiEvents(params, { abortController })) {
        if (signal.aborted) break;
        await sendEvent(evt);
      }
    } catch (error) {
      // If client cancelled, stop silently (don't emit error)
      if (signal.aborted) return;

      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          type: "error",
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      });
    } finally {
      // Ensure underlying SDK query is aborted
      abort();
    }
  });
});

export { wikiRouter };
