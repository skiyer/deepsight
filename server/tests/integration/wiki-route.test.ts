import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSse } from "../helpers/sse.js";

const mockGenerateWikiEvents = vi.fn();

vi.mock("../../src/wiki.js", () => ({
  generateWikiEvents: (params: unknown, options?: unknown) =>
    mockGenerateWikiEvents(params, options),
}));

const { createApp } = await import("../../src/app.js");

const makeStream = (messages: unknown[]) =>
  (async function* () {
    for (const msg of messages) {
      yield msg;
    }
  })();

describe("POST /wiki/generate", () => {
  beforeEach(() => {
    mockGenerateWikiEvents.mockReset();
  });

  it("returns 400 for invalid JSON", async () => {
    const app = createApp();

    const res = await app.request("/wiki/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON" });
  });

  it("returns 400 for invalid request body", async () => {
    const app = createApp();

    const res = await app.request("/wiki/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd: "/repo" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid request" });
  });

  it("streams progress/page/done events", async () => {
    const app = createApp();

    mockGenerateWikiEvents.mockReturnValue(
      makeStream([
        { type: "progress", phase: "scanning", pct: 5 },
        {
          type: "page",
          path: "Home.md",
          title: "主页",
          confidence: "low",
          markdown: "content",
        },
        { type: "done" },
      ])
    );

    const res = await app.request("/wiki/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cwd: "/repo",
        scope: { include: ["**/*"], exclude: [] },
      }),
    });

    const payload = await res.text();
    const events = parseSse(payload);

    expect(events.map((event) => event.event)).toEqual(["progress", "page", "done"]);
    expect(JSON.parse(events[1].data)).toMatchObject({ type: "page", path: "Home.md" });
  });

  it("streams error event when generation fails", async () => {
    const app = createApp();

    mockGenerateWikiEvents.mockReturnValue(
      (async function* () {
        throw new Error("boom");
      })()
    );

    const res = await app.request("/wiki/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cwd: "/repo",
        scope: { include: ["**/*"], exclude: [] },
      }),
    });

    const payload = await res.text();
    const events = parseSse(payload);

    expect(events.map((event) => event.event)).toEqual(["error"]);
    expect(JSON.parse(events[0].data)).toMatchObject({
      type: "error",
      code: "SERVER_ERROR",
      message: "boom",
    });
  });
});
