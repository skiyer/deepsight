import * as vscode from "vscode";

export class DeepSightCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  // Language-specific patterns
  private readonly languagePatterns: Record<string, RegExp[]> = {
    // C/C++
    c: [
      // C function declarations and definitions (with or without {)
      /^(?:static\s+|inline\s+|extern\s+|__inline__\s+)?(?:const\s+|volatile\s+)?(?:unsigned\s+|signed\s+|long\s+|short\s+)?(?:int\s+|void\s+|char\s+|float\s+|double\s+|bool\s+)\s*\*?\s+(\w+)\s*\([^)]*\)\s*(?:__attribute__\s*\(\([^)]*\)\)\s*)?(?:\s*;|\s*\{)/gm,
      // C struct definitions
      /^struct\s+(\w+)/gm,
      // C enum definitions
      /^enum\s+(\w+)/gm,
      // C union definitions
      /^union\s+(\w+)/gm,
    ],
    cpp: [
      // C++ function/method definitions
      /^(?:static\s+|inline\s+|extern\s+|virtual\s+|explicit\s+|constexpr\s+)?(?:const\s+|volatile\s+)?(?:unsigned\s+|signed\s+|long\s+|short\s+)?(?:int\s+|void\s+|char\s+|float\s+|double\s+|bool\s+|auto\s+|std::string\s+|std::vector\s+|std::map\s+|std::set\s+)(?:\s+\*+)?\s*(\w+)\s*\([^)]*\)\s*(?:const\s+)?\s*(?:override\s+)?\s*(?:final\s+)?\{/gm,
      // C++ class definitions
      /^class\s+(\w+)/gm,
      // C++ struct definitions
      /^struct\s+(\w+)/gm,
    ],
    // TypeScript
    typescript: [
      // Function declarations
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,
      // Class methods (fixed: added line anchor ^ to avoid matching if/while)
      /^(?:public|private|protected)?\s*(?:static\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/gm,
      // Arrow functions with assignment
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gm,
      // Class definitions
      /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm,
    ],
    // JavaScript
    javascript: [
      // Function declarations
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,
      // Class methods (fixed: added line anchor ^)
      /^(?:public|private|protected)?\s*(?:static\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/gm,
      // Arrow functions with assignment
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gm,
      // Class definitions
      /^(?:export\s+)?class\s+(\w+)/gm,
    ],
    // TypeScript React
    typescriptreact: [
      // Function declarations
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,
      // Class methods
      /^(?:public|private|protected)?\s*(?:static\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/gm,
      // Arrow functions with assignment
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gm,
      // Class definitions
      /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm,
    ],
    // JavaScript React
    javascriptreact: [
      // Function declarations
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,
      // Class methods
      /^(?:public|private|protected)?\s*(?:static\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/gm,
      // Arrow functions with assignment
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gm,
      // Class definitions
      /^(?:export\s+)?class\s+(\w+)/gm,
    ],
    // Python
    python: [
      // Function definitions
      /^(?:async\s+)?def\s+(\w+)/gm,
      // Class definitions
      /^class\s+(\w+)/gm,
    ],
    // Go
    go: [
      // Function definitions
      /^func\s+(?:\([^)]+\)\s+)?(\w+)/gm,
      // Type definitions
      /^type\s+(\w+)\s+struct/gm,
    ],
    // Rust
    rust: [
      // Function definitions
      /^(?:pub\s*)?(?:async\s+)?fn\s+(\w+)/gm,
      // Struct definitions
      /^(?:pub\s*)?struct\s+(\w+)/gm,
      // Impl blocks
      /^impl(?:<[^>]+>)?\s+(\w+)/gm,
    ],
    // Java
    java: [
      // Method definitions
      /^(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:native\s+)?(?:[\w<>[\]]+\s+)+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*\{/gm,
      // Class definitions
      /^(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/gm,
      // Interface definitions
      /^(?:public\s+)?interface\s+(\w+)/gm,
      // Enum definitions
      /^(?:public\s+)?enum\s+(\w+)/gm,
    ],
  };

  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    try {
      // 优先尝试Symbol Provider
      const symbols = await this.getDocumentSymbols(document, token);
      if (symbols && symbols.length > 0) {
        console.log(`[DeepSight] Symbol Provider matched ${symbols.length} symbols in ${document.languageId} file`);
        return this.createCodeLensesFromSymbols(symbols, document);
      }
      console.log(`[DeepSight] No symbols from provider, falling back to regex for ${document.languageId}`);
    } catch (error) {
      console.warn('[DeepSight] Symbol provider failed:', error);
    }

    // 降级到正则表达式
    return this.createCodeLensesWithRegex(document);
  }

  private async getDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentSymbol[] | null> {
    try {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      if (token.isCancellationRequested) {
        return null;
      }

      return symbols || null;
    } catch {
      return null;
    }
  }

  private isRelevantSymbol(symbol: vscode.DocumentSymbol): boolean {
    const relevantKinds = [
      vscode.SymbolKind.Function,
      vscode.SymbolKind.Method,
      vscode.SymbolKind.Class,
      vscode.SymbolKind.Constructor,
      vscode.SymbolKind.Interface,
      vscode.SymbolKind.Struct,
      vscode.SymbolKind.Enum
    ];
    return relevantKinds.includes(symbol.kind);
  }

  private collectRelevantSymbols(
    symbols: vscode.DocumentSymbol[],
    result: vscode.DocumentSymbol[] = []
  ): vscode.DocumentSymbol[] {
    for (const symbol of symbols) {
      if (this.isRelevantSymbol(symbol)) {
        result.push(symbol);
      }
      if (symbol.children.length > 0) {
        this.collectRelevantSymbols(symbol.children, result);
      }
    }
    return result;
  }

  private createCodeLensesFromSymbols(
    symbols: vscode.DocumentSymbol[],
    document: vscode.TextDocument
  ): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const relevantSymbols = this.collectRelevantSymbols(symbols);
    const lineSet = new Set<number>();

    // 日志记录匹配的符号
    const symbolCounts = new Map<string, number>();
    for (const symbol of relevantSymbols) {
      const kindName = vscode.SymbolKind[symbol.kind];
      symbolCounts.set(kindName, (symbolCounts.get(kindName) || 0) + 1);
    }
    console.log(`[DeepSight] Matched symbols: ${Array.from(symbolCounts.entries()).map(([k, v]) => `${k}:${v}`).join(', ')}`);

    for (const symbol of relevantSymbols) {
      const line = symbol.range.start.line;

      // 防止同一行重复
      if (lineSet.has(line)) {
        continue;
      }
      lineSet.add(line);

      // 在符号名称前创建CodeLens
      const range = new vscode.Range(line, 0, line, 0);

      console.log(`[DeepSight] Symbol: ${symbol.name} (${vscode.SymbolKind[symbol.kind]}) at line ${line + 1}`);

      // Explain按钮
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "✨ 解释",
          command: "deepsight.explain",
          arguments: [document, line],
        })
      );

      // Audit按钮
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "🛡️ 审计",
          command: "deepsight.audit",
          arguments: [document, line],
        })
      );
    }

    return codeLenses;
  }

  private createCodeLensesWithRegex(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lineSet = new Set<number>();

    const patterns = this.languagePatterns[document.languageId];
    if (!patterns) {
      console.log(`[DeepSight] No regex patterns for language: ${document.languageId}`);
      return [];
    }

    console.log(`[DeepSight] Using regex fallback for ${document.languageId} file`);

    let totalMatches = 0;
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const line = document.positionAt(match.index).line;
        if (lineSet.has(line)) {
          continue;
        }
        lineSet.add(line);
        totalMatches++;

        const range = new vscode.Range(line, 0, line, 0);

        // 创建Explain和Audit按钮
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "✨ 解释",
            command: "deepsight.explain",
            arguments: [document, line],
          })
        );

        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "🛡️ 审计",
            command: "deepsight.audit",
            arguments: [document, line],
          })
        );
      }
    }

    console.log(`[DeepSight] Regex matched ${totalMatches} patterns in ${document.languageId} file`);

    return codeLenses;
  }
}
