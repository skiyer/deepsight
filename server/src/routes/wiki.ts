import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { generateWikiEvents, type WikiGenerateParams } from "../wiki.js";

const wikiRouter = new Hono();

const WikiGenerateRequestSchema = z.object({
  cwd: z.string(),
  mode: z.enum(["full", "current"]),
  currentPath: z.string().optional(),
  scope: z.object({
    include: z.array(z.string()),
    exclude: z.array(z.string()),
  }),
  pages: z.array(z.string()),
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
    try {
      for await (const evt of generateWikiEvents(params as WikiGenerateParams)) {
        await stream.writeSSE({
          event: evt.type,
          data: JSON.stringify(evt),
        });
      }
    } catch (error) {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          type: "error",
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      });
    }
  });
});

export { wikiRouter };
