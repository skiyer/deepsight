import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { generateWikiEvents, type WikiGenerateParams } from "../wiki.js";

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
  const body = await c.req.json();
  const parsed = WikiGenerateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.errors }, 400);
  }

  const params = parsed.data;

  return streamSSE(c, async (stream) => {
    const abortController = new AbortController();

    const abort = () => {
      if (!abortController.signal.aborted) {
        abortController.abort();
      }
    };

    // Abort generation when client disconnects / cancels the SSE stream
    stream.onAbort(abort);

    // Also attempt to bind to Request abort (runtime dependent)
    c.req.raw.signal.addEventListener("abort", abort);

    try {
      for await (const evt of generateWikiEvents(params as WikiGenerateParams, { abortController })) {
        if (abortController.signal.aborted) break;
        await stream.writeSSE({
          event: evt.type,
          data: JSON.stringify(evt),
        });
      }
    } catch (error) {
      // If client cancelled, stop silently (don't emit error)
      if (abortController.signal.aborted) return;

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
