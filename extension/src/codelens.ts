import * as vscode from "vscode";

export class DeepSightCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    try {
      const symbols = await this.getDocumentSymbols(document, token);
      if (symbols && symbols.length > 0) {
        console.log(`[DeepSight] Symbol Provider matched ${symbols.length} symbols in ${document.languageId} file`);
        return this.createCodeLensesFromSymbols(symbols, document);
      }
      console.log(`[DeepSight] No symbols from provider for ${document.languageId}`);
      return [];
    } catch (error) {
      console.warn('[DeepSight] Symbol provider failed:', error);
      return [];
    }
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

}
