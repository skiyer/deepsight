import { Hono, type Context } from "hono";
import type { AgentMessage } from "../llm/types.js";
import { analyze, type AnalyzeParams } from "../agent.js";
import { streamSseEvents } from "./sse.js";

const analyzeRouter = new Hono();

type AnalyzeSseEvent = { event: string; data: AgentMessage };

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

const parseAnalyzeBody = async (c: Context): Promise<ParseResult<AnalyzeParams>> => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false, response: c.json({ error: "Invalid JSON" }, 400) };
  }

  if (!body || typeof body !== "object") {
    return { ok: false, response: c.json({ error: "Invalid request" }, 400) };
  }

  const { file, line, lineText, mode, cwd } = body as Record<string, unknown>;

  const isMode = mode === "explain" || mode === "audit";

  if (
    typeof file !== "string" ||
    typeof line !== "number" ||
    !Number.isFinite(line) ||
    typeof lineText !== "string" ||
    typeof cwd !== "string" ||
    !isMode
  ) {
    return { ok: false, response: c.json({ error: "Invalid request" }, 400) };
  }

  return {
    ok: true,
    data: {
      file,
      line,
      lineText,
      mode,
      cwd,
    },
  };
};

const toAnalyzeEvent = (msg: AgentMessage): AnalyzeSseEvent | null => {
  if (msg.type === "stream_event") {
    return { event: "chunk", data: msg };
  }
  if (msg.type === "result") {
    const event = msg.subtype === "success" ? "done" : "error";
    return { event, data: msg };
  }
  return null;
};

analyzeRouter.post("/", async (c) => {
  const parsed = await parseAnalyzeBody(c);
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
