import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSse } from "../helpers/sse.js";

const mockAnalyze = vi.fn();

vi.mock("../../src/agent.js", () => ({
  analyze: (params: unknown, options?: unknown) => mockAnalyze(params, options),
}));

const { createApp } = await import("../../src/app.js");

const makeStream = (messages: unknown[]) =>
  (async function* () {
    for (const msg of messages) {
      yield msg;
    }
  })();

describe("POST /analyze", () => {
  beforeEach(() => {
    mockAnalyze.mockReset();
  });

  it("returns 400 for invalid JSON", async () => {
    const app = createApp();

    const res = await app.request("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON" });
  });

  it("returns 400 for invalid request body", async () => {
    const app = createApp();

    const res = await app.request("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "app.ts" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid request" });
  });

  it("streams chunk and done events", async () => {
    const app = createApp();

    mockAnalyze.mockReturnValue(
      makeStream([
        { type: "stream_event", event: { type: "content_block_delta" } },
        { type: "result", subtype: "success" },
      ])
    );

    const res = await app.request("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "app.ts",
        line: 1,
        lineText: "foo()",
        mode: "explain",
        cwd: "/repo",
      }),
    });

    expect(res.status).toBe(200);
    const payload = await res.text();
    const events = parseSse(payload);

    expect(events.map((event) => event.event)).toEqual(["chunk", "done"]);
    expect(JSON.parse(events[0].data)).toMatchObject({ type: "stream_event" });
  });

  it("streams error event when analyze fails", async () => {
    const app = createApp();

    mockAnalyze.mockReturnValue(
      (async function* () {
        throw new Error("boom");
      })()
    );

    const res = await app.request("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "app.ts",
        line: 1,
        lineText: "foo()",
        mode: "explain",
        cwd: "/repo",
      }),
    });

    const payload = await res.text();
    const events = parseSse(payload);

    expect(events.map((event) => event.event)).toEqual(["error"]);
    expect(JSON.parse(events[0].data)).toEqual({ error: "boom" });
  });
});
