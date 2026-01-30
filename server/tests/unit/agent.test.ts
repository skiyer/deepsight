import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXPLAIN_PROMPT } from "../../src/prompts.js";

const mockCreateClaudeQuery = vi.fn();

vi.mock("../../src/llm/claude.js", () => ({
  createClaudeQuery: (params: unknown) => mockCreateClaudeQuery(params),
}));

const { analyze } = await import("../../src/agent.js");

const makeStream = (messages: unknown[]) =>
  (async function* () {
    for (const msg of messages) {
      yield msg;
    }
  })();

describe("analyze", () => {
  beforeEach(() => {
    mockCreateClaudeQuery.mockReset();
  });

  it("builds prompt and forwards SDK stream", async () => {
    const messages = [{ type: "stream_event", event: { type: "content_block_delta" } }];
    mockCreateClaudeQuery.mockReturnValue(makeStream(messages));

    const params = {
      file: "app.ts",
      line: 12,
      lineText: "  return foo()",
      mode: "explain" as const,
      cwd: "/repo",
    };

    const received: unknown[] = [];
    for await (const msg of analyze(params)) {
      received.push(msg);
    }

    expect(received).toEqual(messages);
    expect(mockCreateClaudeQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "/repo",
        systemPrompt: EXPLAIN_PROMPT,
        prompt: expect.stringContaining("return foo()"),
      })
    );
  });

  it("uses fallback when line text is empty", async () => {
    mockCreateClaudeQuery.mockReturnValue(makeStream([]));

    const params = {
      file: "app.ts",
      line: 4,
      lineText: "   ",
      mode: "explain" as const,
      cwd: "/repo",
    };

    for await (const _ of analyze(params)) {
      // consume
    }

    const call = mockCreateClaudeQuery.mock.calls[0]?.[0] as { prompt: string };
    expect(call.prompt).toContain("[无法获取焦点行代码]");
  });

  it("ignores errors when aborted", async () => {
    const abortController = new AbortController();
    abortController.abort();

    mockCreateClaudeQuery.mockReturnValue(
      (async function* () {
        throw new Error("boom");
      })()
    );

    const params = {
      file: "app.ts",
      line: 1,
      lineText: "foo()",
      mode: "explain" as const,
      cwd: "/repo",
    };

    const run = async () => {
      for await (const _ of analyze(params, { abortController })) {
        // no-op
      }
    };

    await expect(run()).resolves.toBeUndefined();
  });
});
