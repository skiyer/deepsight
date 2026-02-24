import { describe, expect, it } from "vitest";
import { parseSseBlock, readSseStream } from "../src/run.js";
import { makeReadableStream, makeSseEvent } from "./helpers/streams.js";

describe("parseSseBlock", () => {
  it("parses event and multi-line data", () => {
    const block = ["event: page", "data: {\"a\":1}", "data: {\"b\":2}"].join("\n");

    expect(parseSseBlock(block)).toEqual({
      event: "page",
      data: "{\"a\":1}\n{\"b\":2}",
    });
  });

  it("returns null when data is missing", () => {
    expect(parseSseBlock("event: page")).toBeNull();
  });
});

describe("readSseStream", () => {
  it("emits events in order", async () => {
    const stream = makeReadableStream([
      makeSseEvent("progress", { pct: 10 }),
      makeSseEvent("done", {}),
    ]);

    const events: string[] = [];

    await readSseStream(stream, async (event) => {
      events.push(`${event.event}:${event.data}`);
    });

    expect(events).toEqual(["progress:{\"pct\":10}", "done:{}"]);
  });
});
