import { describe, expect, it } from "vitest";
import {
  buildFrontMatter,
  parseFrontMatter,
  splitFrontMatter,
} from "../../src/utils/frontmatter";

describe("frontmatter utils", () => {
  it("splits front matter and body", () => {
    const input = "---\nfoo: bar\n---\n\nBody line\nSecond";
    const result = splitFrontMatter(input);
    expect(result.frontMatter).toBe("foo: bar");
    expect(result.body).toBe("Body line\nSecond");
  });

  it("parses front matter key-values", () => {
    const frontMatter = "created: 2020-01-01\n# comment\nmodel: claude";
    expect(parseFrontMatter(frontMatter)).toEqual({
      created: "2020-01-01",
      model: "claude",
    });
  });

  it("builds front matter with defaults", () => {
    const now = "2024-01-01T00:00:00.000Z";
    const result = buildFrontMatter({
      title: "Home",
      now,
      existingFrontMatter: "created: 2020-01-01\nmodel: gpt",
      confidence: "high",
      blindSpots: ["auth", "secrets"],
      scope: { include: ["server"], exclude: ["dist"] },
      serverUrl: "http://localhost:3000",
    });

    const lines = result.split("\n");
    expect(lines).toContain("title: Home");
    expect(lines).toContain("created: 2020-01-01");
    expect(lines).toContain("model: gpt");
    expect(lines).toContain("confidence: high");
    expect(lines).toContain("blindSpots: [\"auth\", \"secrets\"]");
    expect(lines).toContain('scope:');
    expect(lines).toContain('  include: ["server"]');
    expect(lines).toContain('  exclude: ["dist"]');
  });
});
