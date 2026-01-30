export interface SymbolLike {
  kind: number;
  range: { start: { line: number } };
  children?: SymbolLike[];
}

export const collectRelevantSymbols = (
  symbols: SymbolLike[],
  relevantKinds: Set<number>,
  result: SymbolLike[] = []
): SymbolLike[] => {
  for (const symbol of symbols) {
    if (relevantKinds.has(symbol.kind)) {
      result.push(symbol);
    }
    if (symbol.children && symbol.children.length > 0) {
      collectRelevantSymbols(symbol.children, relevantKinds, result);
    }
  }
  return result;
};

export const collectRelevantSymbolLines = (
  symbols: SymbolLike[],
  relevantKinds: Set<number>
): number[] => {
  const relevantSymbols = collectRelevantSymbols(symbols, relevantKinds);
  const lineSet = new Set<number>();
  const lines: number[] = [];

  for (const symbol of relevantSymbols) {
    const line = symbol.range.start.line;
    if (lineSet.has(line)) continue;
    lineSet.add(line);
    lines.push(line);
  }

  return lines;
};
