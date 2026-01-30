import * as vscode from "vscode";
import { collectRelevantSymbolLines } from "./utils/codelens";

const RELEVANT_SYMBOL_KINDS = new Set<number>([
  vscode.SymbolKind.Function,
  vscode.SymbolKind.Method,
  vscode.SymbolKind.Class,
  vscode.SymbolKind.Constructor,
  vscode.SymbolKind.Interface,
  vscode.SymbolKind.Struct,
  vscode.SymbolKind.Enum,
]);

export class DeepSightCodeLensProvider implements vscode.CodeLensProvider {
  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    try {
      const symbols = await this.getDocumentSymbols(document, token);
      if (symbols && symbols.length > 0) {
        return this.createCodeLensesFromSymbols(symbols, document);
      }
      return [];
    } catch {
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

  private createCodeLensesFromSymbols(
    symbols: vscode.DocumentSymbol[],
    document: vscode.TextDocument
  ): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const lines = collectRelevantSymbolLines(symbols, RELEVANT_SYMBOL_KINDS);

    for (const line of lines) {
      // 在符号名称前创建CodeLens
      const range = new vscode.Range(line, 0, line, 0);

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
