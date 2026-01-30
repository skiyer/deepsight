import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateWikiEvents } from "../../src/wiki.js";

const ORIGINAL_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN;

describe("generateWikiEvents", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
  });

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env.ANTHROPIC_AUTH_TOKEN;
    } else {
      process.env.ANTHROPIC_AUTH_TOKEN = ORIGINAL_TOKEN;
    }
  });

  it("emits missing token error and stops", async () => {
    const params = {
      cwd: "/repo",
      scope: { include: ["**/*"], exclude: [] },
    };

    const events: unknown[] = [];
    for await (const event of generateWikiEvents(params)) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: "error",
        code: "MISSING_TOKEN",
        message: "ANTHROPIC_AUTH_TOKEN is not set",
      },
    ]);
  });
});
