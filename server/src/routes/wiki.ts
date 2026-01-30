import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { generateWikiEvents, type WikiGenerateParams } from "../wiki.js";

const wikiRouter = new Hono();

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

type WikiLimits = { maxFilesRead?: number; maxBytesRead?: number };

type ParsedOptional<T> = T | undefined | null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const parseOptionalStringArray = (value: unknown): ParsedOptional<string[]> => {
  if (value === undefined) return undefined;
  return isStringArray(value) ? value : null;
};

const parseLimits = (value: unknown): ParsedOptional<WikiLimits> => {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const limits: WikiLimits = {};

  if (raw.maxFilesRead !== undefined) {
    if (!Number.isInteger(raw.maxFilesRead) || (raw.maxFilesRead as number) <= 0) {
      return null;
    }
    limits.maxFilesRead = raw.maxFilesRead as number;
  }

  if (raw.maxBytesRead !== undefined) {
    if (!Number.isInteger(raw.maxBytesRead) || (raw.maxBytesRead as number) <= 0) {
      return null;
    }
    limits.maxBytesRead = raw.maxBytesRead as number;
  }

  return limits;
};

const parseWikiBody = async (c: Context): Promise<ParseResult<WikiGenerateParams>> => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false, response: c.json({ error: "Invalid JSON" }, 400) };
  }

  if (!body || typeof body !== "object") {
    return { ok: false, response: c.json({ error: "Invalid request" }, 400) };
  }

  const { cwd, scope, pages, sensitivePaths, limits } = body as Record<string, unknown>;

  if (!scope || typeof scope !== "object") {
    return { ok: false, response: c.json({ error: "Invalid request" }, 400) };
  }

  const rawScope = scope as Record<string, unknown>;
  const include = isStringArray(rawScope.include) ? rawScope.include : null;
  const exclude = isStringArray(rawScope.exclude) ? rawScope.exclude : null;
  const parsedPages = parseOptionalStringArray(pages);
  const parsedSensitivePaths = parseOptionalStringArray(sensitivePaths);
  const parsedLimits = parseLimits(limits);

  if (
    typeof cwd !== "string" ||
    !include ||
    !exclude ||
    parsedPages === null ||
    parsedSensitivePaths === null ||
    parsedLimits === null
  ) {
    return { ok: false, response: c.json({ error: "Invalid request" }, 400) };
  }

  return {
    ok: true,
    data: {
      cwd,
      scope: { include, exclude },
      pages: parsedPages,
      sensitivePaths: parsedSensitivePaths,
      limits: parsedLimits,
    },
  };
};

wikiRouter.post("/generate", async (c) => {
  const parsed = await parseWikiBody(c);
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

    stream.onAbort(abort);
    c.req.raw.signal?.addEventListener("abort", abort, { once: true });

    const send = async (event: { event: string; data: unknown }) => {
      await stream.writeSSE({
        event: event.event,
        data: JSON.stringify(event.data),
      });
    };

    try {
      for await (const item of generateWikiEvents(params, { abortController })) {
        if (signal.aborted) break;
        await send({ event: item.type, data: item });
      }
    } catch (error) {
      if (!signal.aborted) {
        await send({
          event: "error",
          data: {
            type: "error",
            code: "SERVER_ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    } finally {
      abort();
    }
  });
});

export { wikiRouter };
