import * as vscode from "vscode";

export class DeepSightCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  // Language-specific patterns
  private readonly languagePatterns: Record<string, RegExp[]> = {
    // C/C++
    c: [
      // C function definitions (static, inline, extern, type qualifiers)
      /^(?:static\s+|inline\s+|extern\s+|__inline__\s+)?(?:const\s+|volatile\s+)?(?:unsigned\s+|signed\s+|long\s+|short\s+)?(?:int\s+|void\s+|char\s+|float\s+|double\s+|bool\s+)(?:\s+\*+)?\s+(\w+)\s*\([^)]*\)\s*(?:__attribute__\s*\(\([^)]*\)\)\s*)?\{/gm,
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

  public provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lineSet = new Set<number>();

    // Get patterns for current language
    const patterns = this.languagePatterns[document.languageId];
    if (!patterns) {
      return [];
    }

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const line = document.positionAt(match.index).line;

        // Skip duplicate lines
        if (lineSet.has(line)) {
          continue;
        }
        lineSet.add(line);

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
