const SYMBOL_PATTERNS: RegExp[] = [
  // JavaScript/TypeScript: function, class, arrow function assignment
  /(?:function|class)\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=/,
  // Python: def, class
  /(?:def|class)\s+(\w+)/,
  // Go/Rust: func, fn, struct, impl
  /(?:func|fn|struct|impl)\s+(?:\([^)]+\)\s+)?(\w+)/,
  // C/C++/Java: function/method with return type
  /(?:void|int|char|float|double|bool|auto|static|inline|public|private|protected|virtual|final|explicit|constexpr)\s+(?:[\w<>[\]]+\s+)*(\w+)\s*\(/,
];

export function extractSymbolName(lineText: string): string | null {
  for (const pattern of SYMBOL_PATTERNS) {
    const match = lineText.match(pattern);
    if (!match) continue;
    for (let i = 1; i < match.length; i++) {
      if (match[i]) {
        return match[i];
      }
    }
  }
  return null;
}
