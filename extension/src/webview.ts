import * as vscode from "vscode";

// Block types
interface BaseBlock {
  id: string;
  status: "streaming" | "done";
}

interface TextBlock extends BaseBlock {
  type: "text";
  content: string;
}

interface ToolBlock extends BaseBlock {
  type: "tool";
  name: string;
  info?: string;
}

interface ThinkingBlock extends BaseBlock {
  type: "thinking";
  content: string;
}

type ContentBlock = TextBlock | ToolBlock | ThinkingBlock;

// Complete state that Extension maintains as single source of truth
interface ViewState {
  status: "empty" | "loading" | "streaming" | "done" | "error";
  anchor: string;
  mode: "explain" | "audit";
  blocks: ContentBlock[];
  error: string;
}

export class DeepSightViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "deepsight.resultView";
  private _view?: vscode.WebviewView;
  private _isReady: boolean = false;
  private _resolveWhenReady?: () => void;

  // Single source of truth - complete state
  private _state: ViewState = {
    status: "empty",
    anchor: "",
    mode: "explain",
    blocks: [],
    error: "",
  };

  private _blockIdCounter = 0;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  // Generate unique block ID
  private _generateBlockId(): string {
    return `block-${++this._blockIdCounter}`;
  }

  // Wait for webview to be ready
  public async waitForReady(): Promise<void> {
    if (this._isReady && this._view) {
      return;
    }
    return new Promise((resolve) => {
      this._resolveWhenReady = resolve;
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    this._isReady = false;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent();

    // Listen for ready message from webview
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.type === "ready") {
        this._isReady = true;
        // Send complete state snapshot
        this._syncState();
        // Resolve waiting promise
        if (this._resolveWhenReady) {
          this._resolveWhenReady();
          this._resolveWhenReady = undefined;
        }
      }
    });

    // Handle visibility changes - resync state when becoming visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._isReady) {
        // Webview became visible again, resync complete state
        this._syncState();
      }
    });
  }

  // Send complete state to webview
  private _syncState() {
    if (this._view && this._isReady) {
      this._view.webview.postMessage({
        type: "state_sync",
        state: this._state,
      });
    }
  }

  public setLoading(anchor: string, mode: "explain" | "audit") {
    this._blockIdCounter = 0;
    this._state = {
      status: "loading",
      anchor,
      mode,
      blocks: [],
      error: "",
    };
    this._syncState();
  }

  // Start a new block
  public startBlock(type: "text" | "tool" | "thinking", initialData?: { name?: string }) {
    const id = this._generateBlockId();

    let newBlock: ContentBlock;

    switch (type) {
      case "text":
        newBlock = { id, status: "streaming", type: "text", content: "" };
        break;
      case "tool":
        newBlock = {
          id,
          status: "streaming",
          type: "tool",
          name: initialData?.name || "Unknown",
        };
        break;
      case "thinking":
        newBlock = { id, status: "streaming", type: "thinking", content: "" };
        break;
    }

    this._state.blocks = [...this._state.blocks, newBlock];
    if (this._state.status === "loading") {
      this._state.status = "streaming";
    }
    this._syncState();
  }

  // Append to current text block (or create new one)
  public appendToCurrentTextBlock(chunk: string) {
    const blocks = this._state.blocks;
    const lastBlock = blocks[blocks.length - 1];

    // If last block is a streaming text block, append to it
    if (lastBlock?.type === "text" && lastBlock.status === "streaming") {
      (lastBlock as TextBlock).content += chunk;
    } else {
      // Otherwise create a new text block with this chunk
      this.startBlock("text");
      const newLastBlock = this._state.blocks[this._state.blocks.length - 1] as TextBlock;
      newLastBlock.content = chunk;
    }

    if (this._state.status === "loading") {
      this._state.status = "streaming";
    }
    this._syncState();
  }

  // Append to current thinking block
  public appendToThinkingBlock(chunk: string) {
    const blocks = this._state.blocks;
    const lastBlock = blocks[blocks.length - 1];

    if (lastBlock?.type === "thinking" && lastBlock.status === "streaming") {
      (lastBlock as ThinkingBlock).content += chunk;
      this._syncState();
    }
  }

  // Update tool block info
  public updateToolBlock(info: string) {
    const blocks = this._state.blocks;
    // Find the most recent streaming tool block
    const toolBlock = [...blocks].reverse().find(
      (b) => b.type === "tool" && b.status === "streaming"
    ) as ToolBlock | undefined;

    if (toolBlock) {
      toolBlock.info = info;
      this._syncState();
    }
  }

  // Complete the current block (non-tool)
  public completeCurrentBlock() {
    const blocks = this._state.blocks;
    const lastBlock = blocks[blocks.length - 1];

    if (lastBlock && lastBlock.status === "streaming" && lastBlock.type !== "tool") {
      lastBlock.status = "done";
      this._syncState();
    }
  }

  // Complete tool block (when tool_result arrives)
  public completeToolBlock() {
    const blocks = this._state.blocks;
    // Find the most recent streaming tool block
    const toolBlock = [...blocks].reverse().find(
      (b) => b.type === "tool" && b.status === "streaming"
    );

    if (toolBlock) {
      toolBlock.status = "done";
      this._syncState();
    }
  }

  public setComplete() {
    // Mark any remaining streaming blocks as done
    for (const block of this._state.blocks) {
      if (block.status === "streaming") {
        block.status = "done";
      }
    }
    this._state.status = "done";
    this._syncState();
  }

  public setError(message: string) {
    this._state.status = "error";
    this._state.error = message;
    this._syncState();
  }

  private _getHtmlContent(): string {
    const webview = this._view!.webview;

    // Get URIs for the webview-ui dist files
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "webview-ui", "dist", "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "webview-ui", "dist", "assets", "index.css")
    );

    // Use a nonce for security
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>DeepSight</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private _getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
