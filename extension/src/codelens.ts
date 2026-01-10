import * as vscode from "vscode";

export class DeepSightCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  public provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();

    // Match function/method definitions
    const patterns = [
      // JavaScript/TypeScript: function, async function, arrow functions, methods
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g,
      /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g,
      // Class definitions
      /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g,
      // Python: def, class
      /^(?:async\s+)?def\s+(\w+)/gm,
      /^class\s+(\w+)/gm,
      // Go: func
      /^func\s+(?:\([^)]+\)\s+)?(\w+)/gm,
      // Rust: fn, impl, struct
      /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/g,
      /(?:pub\s+)?struct\s+(\w+)/g,
      /impl(?:<[^>]+>)?\s+(\w+)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const line = document.positionAt(match.index).line;
        const range = new vscode.Range(line, 0, line, 0);

        // Explain button
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "✨ 解释",
            command: "deepsight.explain",
            arguments: [document, line],
          })
        );

        // Audit button
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "🛡️ 审计",
            command: "deepsight.audit",
            arguments: [document, line],
          })
        );
      }
    }

    return codeLenses;
  }
}
