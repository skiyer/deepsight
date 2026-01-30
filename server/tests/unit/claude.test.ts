import { describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: (params: unknown) => mockQuery(params),
}));

const { createClaudeQuery } = await import("../../src/llm/claude.js");

const makeSdkStream = (messages: unknown[]) =>
  (async function* () {
    for (const msg of messages) {
      yield msg;
    }
  })();

describe("createClaudeQuery", () => {
  it("passes options and maps unknown message types", async () => {
    const sdkMessages = [
      { type: "stream_event", event: { type: "content_block_delta" } },
      { type: "mystery", foo: "bar" },
    ];

    mockQuery.mockReturnValue(makeSdkStream(sdkMessages));

    const stream = createClaudeQuery({
      prompt: "hello",
      cwd: "/repo",
      systemPrompt: "system",
    });

    const received: unknown[] = [];
    for await (const msg of stream) {
      received.push(msg);
    }

    expect(mockQuery).toHaveBeenCalledWith({
      prompt: "hello",
      options: expect.objectContaining({
        cwd: "/repo",
        systemPrompt: "system",
        allowedTools: ["Read", "Glob"],
      }),
    });

    expect(received[0]).toEqual(sdkMessages[0]);
    expect(received[1]).toEqual({ type: "unknown", raw: sdkMessages[1] });
  });
});
