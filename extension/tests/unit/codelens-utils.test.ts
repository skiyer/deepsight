import { describe, expect, it } from "vitest";
import {
  collectRelevantSymbolLines,
  collectRelevantSymbols,
  type SymbolLike,
} from "../../src/utils/codelens";

describe("codelens utils", () => {
  it("collects relevant symbols in depth-first order", () => {
    const symbols: SymbolLike[] = [
      {
        kind: 1,
        range: { start: { line: 0 } },
        children: [
          { kind: 2, range: { start: { line: 1 } }, children: [] },
          { kind: 3, range: { start: { line: 2 } }, children: [] },
        ],
      },
      {
        kind: 2,
        range: { start: { line: 3 } },
        children: [],
      },
    ];

    const relevantKinds = new Set([1, 2]);
    const collected = collectRelevantSymbols(symbols, relevantKinds);

    expect(collected.map((symbol) => symbol.range.start.line)).toEqual([0, 1, 3]);
  });

  it("deduplicates lines", () => {
    const symbols: SymbolLike[] = [
      {
        kind: 1,
        range: { start: { line: 4 } },
        children: [
          { kind: 1, range: { start: { line: 4 } }, children: [] },
          { kind: 2, range: { start: { line: 5 } }, children: [] },
        ],
      },
    ];

    const relevantKinds = new Set([1, 2]);
    const lines = collectRelevantSymbolLines(symbols, relevantKinds);
    expect(lines).toEqual([4, 5]);
  });
});
