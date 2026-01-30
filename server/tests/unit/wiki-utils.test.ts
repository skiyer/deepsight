import { describe, expect, it } from "vitest";
import {
  extractBlindSpots,
  extractConfidence,
  isExcludedPath,
  isSensitivePath,
  normalizePath,
  splitFrontMatter,
} from "../../src/wiki-utils.js";

describe("wiki-utils", () => {
  it("normalizes windows paths", () => {
    expect(normalizePath("C:\\repo\\src\\index.ts")).toBe("C:/repo/src/index.ts");
  });

  it("matches excluded patterns", () => {
    expect(isExcludedPath("/repo/src/index.ts", ["**/src/**"])).toBe(true);
    expect(isExcludedPath("/repo/test/index.ts", ["**/src/**"])).toBe(false);
  });

  it("matches sensitive paths by basename", () => {
    expect(isSensitivePath("/repo/.env", [".env"])).toBe(true);
    expect(isSensitivePath("/repo/config.json", [".env"])).toBe(false);
  });

  it("splits front matter", () => {
    const input = "---\ntitle: Hello\n---\n\nBody line\nSecond";
    const result = splitFrontMatter(input);
    expect(result.frontMatter).toBe("title: Hello");
    expect(result.body).toBe("Body line\nSecond");
  });

  it("extracts confidence and blind spots", () => {
    const markdown = "confidence: low\nblindSpots: [db, secrets]";
    expect(extractConfidence(markdown)).toBe("low");
    expect(extractBlindSpots(markdown)).toEqual(["db", "secrets"]);
  });

  it("defaults confidence to medium", () => {
    expect(extractConfidence("no confidence here")).toBe("medium");
  });
});
