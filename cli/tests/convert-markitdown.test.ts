import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

const { convertWithMarkitdown } = await import("../src/run.js");

const makeStat = (mtimeMs: number) => ({ mtimeMs }) as fs.Stats;

describe("convertWithMarkitdown", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns failed when source stat fails", async () => {
    const statSpy = vi.spyOn(fs, "stat").mockRejectedValue(new Error("missing"));

    const result = await convertWithMarkitdown("/missing.docx", "/out.md");

    expect(result.status).toBe("failed");
    expect(result.error).toContain("stat failed");
    expect(statSpy).toHaveBeenCalled();
  });

  it("returns cached when output is newer", async () => {
    vi.spyOn(fs, "stat").mockImplementation(async (filePath) => {
      if (filePath === "/source.docx") return makeStat(10);
      if (filePath === "/out.md") return makeStat(20);
      throw new Error(`unexpected path: ${filePath}`);
    });

    const result = await convertWithMarkitdown("/source.docx", "/out.md");

    expect(result.status).toBe("cached");
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("invokes markitdown when conversion is needed", async () => {
    vi.spyOn(fs, "stat")
      .mockImplementationOnce(async () => makeStat(10))
      .mockRejectedValueOnce(new Error("missing"));
    vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);

    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (...cbArgs: unknown[]) => void;
      callback(null, "", "");
    });

    const result = await convertWithMarkitdown("/source.docx", "/out.md");

    expect(result.status).toBe("converted");
    expect(execFileMock).toHaveBeenCalled();
  });

  it("reports failure when markitdown returns error", async () => {
    vi.spyOn(fs, "stat")
      .mockImplementationOnce(async () => makeStat(10))
      .mockRejectedValueOnce(new Error("missing"));
    vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);

    execFileMock.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (err?: Error | null) => void;
      callback(new Error("boom"));
    });

    const result = await convertWithMarkitdown("/source.docx", "/out.md");

    expect(result.status).toBe("failed");
    expect(result.error).toContain("markitdown failed");
  });
});
