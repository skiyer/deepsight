import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { generateWikiReports } from "../src/run.js";
import { createWorkspace } from "./helpers/workspace.js";
import { makeReadableStream, makeSseEvent } from "./helpers/streams.js";

let cleanup: (() => Promise<void>) | undefined;

afterEach(async () => {
  vi.unstubAllGlobals();
  if (cleanup) {
    await cleanup();
    cleanup = undefined;
  }
});

describe("generateWikiReports", () => {
  it("writes page events to reports directory", async () => {
    const workspace = await createWorkspace();
    cleanup = workspace.cleanup;

    const reportsDir = path.join(workspace.root, "reports");
    await fs.mkdir(reportsDir, { recursive: true });

    const stream = makeReadableStream([
      makeSseEvent("progress", { pct: 10, message: "Scanning" }),
      makeSseEvent("page", { path: "Home.md", markdown: "content" }),
      makeSseEvent("done", {}),
    ]);

    const fetchMock = vi.fn(async () => new Response(stream, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await generateWikiReports("http://localhost:3000", workspace.root, reportsDir);

    const outputPath = path.join(reportsDir, "Home.md");
    await expect(fs.readFile(outputPath, "utf-8")).resolves.toBe("content");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/wiki/generate",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when server reports an error", async () => {
    const workspace = await createWorkspace();
    cleanup = workspace.cleanup;

    const reportsDir = path.join(workspace.root, "reports");
    await fs.mkdir(reportsDir, { recursive: true });

    const stream = makeReadableStream([
      makeSseEvent("error", { code: "FAIL", message: "boom" }),
    ]);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { status: 200 })));

    await expect(
      generateWikiReports("http://localhost:3000", workspace.root, reportsDir)
    ).rejects.toThrow("Wiki generation failed: FAIL boom");
  });
});
