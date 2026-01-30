import { describe, expect, it } from "vitest";
import { getToolDisplayInfo } from "../../src/utils/toolDisplay";

describe("getToolDisplayInfo", () => {
  it("formats Read and Glob inputs", () => {
    expect(getToolDisplayInfo("Read", { file_path: "/tmp/file.ts" }))
      .toBe("file.ts");
    expect(getToolDisplayInfo("Glob", { pattern: "**/*.ts" }))
      .toBe("**/*.ts");
  });

  it("formats generic inputs", () => {
    expect(getToolDisplayInfo("Other", "hello")).toBe("hello");
    expect(getToolDisplayInfo("Other", { a: 1 })).toBe("{\"a\":1}");
  });

  it("returns placeholder for empty inputs", () => {
    expect(getToolDisplayInfo("Other", null)).toBe("—");
  });
});
