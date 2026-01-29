import { Hono } from "hono";
import { z } from "zod";
import { generateWikiEvents } from "../wiki.js";
import { parseJson } from "./validate.js";
import { streamSseEvents } from "./sse.js";

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

  return streamSseEvents(c, {
    createStream: (abortController) => generateWikiEvents(params, { abortController }),
    toEvent: (event) => ({ event: event.type, data: event }),
    onError: (error) => ({
      event: "error",
      data: {
        type: "error",
        code: "SERVER_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    }),
  });
});

export { wikiRouter };
