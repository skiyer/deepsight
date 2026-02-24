import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { runCli } from "../src/run.js";
import { createWorkspace, writeWorkspaceFile } from "./helpers/workspace.js";
import { makeReadableStream, makeSseEvent } from "./helpers/streams.js";

const ORIGINAL_ENV = { ...process.env };

let workspaceRoot: string | null = null;
let cleanup: (() => Promise<void>) | undefined;

beforeEach(async () => {
  const workspace = await createWorkspace();
  workspaceRoot = workspace.root;
  cleanup = workspace.cleanup;
});

afterEach(async () => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (cleanup) {
    await cleanup();
    cleanup = undefined;
  }
  workspaceRoot = null;
});

describe("runCli", () => {
  it("fails fast when ANTHROPIC_AUTH_TOKEN is missing", async () => {
    process.env.DEEPSIGHT_WORKSPACE = workspaceRoot ?? "/workspace";
    delete process.env.ANTHROPIC_AUTH_TOKEN;

    await expect(runCli()).rejects.toThrow("ANTHROPIC_AUTH_TOKEN is not set");
  });

  it("runs end-to-end for markdown docs", async () => {
    if (!workspaceRoot) throw new Error("workspace not set");

    process.env.DEEPSIGHT_WORKSPACE = workspaceRoot;
    process.env.ANTHROPIC_AUTH_TOKEN = "token";

    await writeWorkspaceFile(workspaceRoot, "docs/README.md", "# Readme\nLine");

    const stream = makeReadableStream([
      makeSseEvent("progress", { pct: 10, message: "Scanning" }),
      makeSseEvent("page", { path: "Home.md", markdown: "wiki content" }),
      makeSseEvent("done", {}),
    ]);

    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return new Response(stream, { status: 200 });
      }
      return new Response("", { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runCli();

    // docs-index.md 已不再生成，只验证报告
    const reportsPath = path.join(workspaceRoot, "reports", "Home.md");
    await expect(fs.readFile(reportsPath, "utf-8")).resolves.toBe("wiki content");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/wiki/generate"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
