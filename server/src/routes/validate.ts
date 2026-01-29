import type { Context } from "hono";
import type { ZodTypeAny } from "zod";

type ParseResult<T extends ZodTypeAny> =
  | { ok: true; data: T["_output"] }
  | { ok: false; response: Response };

export async function parseJson<T extends ZodTypeAny>(
  c: Context,
  schema: T
): Promise<ParseResult<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false, response: c.json({ error: "Invalid JSON" }, 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: c.json({ error: "Invalid request", details: parsed.error.errors }, 400),
    };
  }

  return { ok: true, data: parsed.data };
}
