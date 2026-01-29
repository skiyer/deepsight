import * as vscode from "vscode";

type PageMode = "analysis" | "wiki";

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
type WikiPageType =
  | "home"
  | "architecture"
  | "modules"
  | "dataflow"
  | "trust-boundaries"
  | "attack-surface"
  | "custom";

interface WikiPageMeta {
  path: string; // relative to .deepsight/wiki
  title: string;
  type: WikiPageType;
  order: number;
}

type WikiGenerationStatus = "idle" | "running" | "done" | "error" | "canceled";

type WikiGenerationPhase = "scanning" | "drafting" | "writing" | "";

interface WikiGenerationState {
  status: WikiGenerationStatus;
  mode: "full" | "current" | "";
  phase: WikiGenerationPhase;
  pct: number; // 0-100
  message: string;
  page: string;
  error: string;
}

interface WikiState {
  status: "idle" | "loading" | "error";
  workspaceRoot: string;
  pages: WikiPageMeta[];
  currentPath: string;
  content: string;
  dirty: boolean;
  error: string;
  lastSavedAt: string;

  generation: WikiGenerationState;
}

interface ViewState {
  // Existing analysis state (kept for minimal UI impact)
  status: "empty" | "loading" | "streaming" | "done" | "error";
  anchor: string;
  mode: "explain" | "audit";
  blocks: ContentBlock[];
  error: string;

  // New: top-level page selector
  page: PageMode;

  // New: wiki state
  wiki: WikiState;
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

    page: "analysis",
    wiki: {
      status: "idle",
      workspaceRoot: "",
      pages: [],
      currentPath: "",
      content: "",
      dirty: false,
      error: "",
      lastSavedAt: "",
      generation: {
        status: "idle",
        mode: "",
        phase: "",
        pct: 0,
        message: "",
        page: "",
        error: "",
      },
    },
  };

  private _blockIdCounter = 0;

  private _wikiWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private _wikiRefreshTimer: NodeJS.Timeout | undefined;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public dispose() {
    for (const watcher of this._wikiWatchers.values()) {
      watcher.dispose();
    }
    this._wikiWatchers.clear();
    if (this._wikiRefreshTimer) {
      clearTimeout(this._wikiRefreshTimer);
      this._wikiRefreshTimer = undefined;
    }
  }

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

    // Listen for messages from webview (register BEFORE setting html to avoid missing early 'ready')
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === "ready") {
        this._isReady = true;
        this._syncState();
        if (this._resolveWhenReady) {
          this._resolveWhenReady();
          this._resolveWhenReady = undefined;
        }
        return;
      }

      try {
        switch (message?.type) {
          case "navigate": {
            await this.navigateTo(message.page as PageMode);
            break;
          }
          case "wiki_list": {
            await this._refreshWikiPages();
            break;
          }
          case "wiki_open": {
            await this._openWikiPage(String(message.path || ""));
            break;
          }
          case "wiki_open_in_editor": {
            await this._openWikiPageInEditor(String(message.path || ""));
            break;
          }
          case "wiki_generate": {
            // Fire-and-forget: generation can take long; don't block message loop (needed for Cancel)
            void vscode.commands.executeCommand("deepsight.generateWiki");
            break;
          }
          case "wiki_cancel_generation": {
            void vscode.commands.executeCommand("deepsight.cancelWiki");
            break;
          }
          default:
            break;
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        this._state.wiki.status = "error";
        this._state.wiki.error = error;
        this._syncState();
      }
    });

    webviewView.webview.html = this._getHtmlContent();

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

      page: this._state.page,
      wiki: this._state.wiki,
    };
    this._syncState();
  }

  public async navigateTo(page: PageMode): Promise<void> {
    this._state.page = page;
    if (page === "wiki") {
      await this._ensureWikiInitialized();
      if (!this._state.wiki.pages.length) {
        await this._refreshWikiPages();
      }
      if (!this._state.wiki.currentPath && this._state.wiki.pages.length) {
        await this._openWikiPage(this._state.wiki.pages[0].path);
      }
    }
    this._syncState();
  }

  private _getWorkspaceRootUri(): vscode.Uri | undefined {
    const activeDoc = vscode.window.activeTextEditor?.document;
    if (activeDoc) {
      const folder = vscode.workspace.getWorkspaceFolder(activeDoc.uri);
      if (folder) return folder.uri;
    }
    return vscode.workspace.workspaceFolders?.[0]?.uri;
  }

  private _wikiDir(root: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(root, ".deepsight", "wiki");
  }

  private _wikiIndexUri(root: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(this._wikiDir(root), "index.json");
  }

  private _wikiPageUri(root: vscode.Uri, relativePath: string): vscode.Uri {
    const normalized = relativePath.replace(/^\/+/, "");
    return vscode.Uri.joinPath(this._wikiDir(root), ...normalized.split("/"));
  }

  private async _exists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  private _defaultWikiIndex(): { version: number; pages: WikiPageMeta[] } {
    return {
      version: 1,
      pages: [
        { path: "Home.md", title: "主页", type: "home", order: 1 },
        { path: "Architecture.md", title: "系统架构", type: "architecture", order: 2 },
        { path: "Modules.md", title: "模块", type: "modules", order: 3 },
        { path: "Dataflow.md", title: "数据流", type: "dataflow", order: 4 },
        { path: "TrustBoundaries.md", title: "信任边界", type: "trust-boundaries", order: 5 },
        { path: "AttackSurface.md", title: "攻击面", type: "attack-surface", order: 6 },
      ],
    };
  }

  private _defaultWikiPageContent(meta: WikiPageMeta): string {
    const now = new Date().toISOString();
    const header = `---\ntitle: ${meta.title}\ntype: ${meta.type}\nupdated: ${now}\n---\n\n`;

    switch (meta.type) {
      case "home":
        return (
          header +
          `# ${meta.title}\n\n` +
          `本目录用于沉淀面向安全审计/渗透的系统级分析 Wiki（适配超大规模仓库）。\n\n` +
          `建议从以下页面开始：\n\n` +
          `- System Architecture\n- Modules\n- Dataflow\n- Trust Boundaries\n- Attack Surface\n`
        );
      case "architecture":
        return (
          header +
          `# ${meta.title}\n\n` +
          `## 目标\n- 用一句话描述系统做什么\n- 明确核心边界/依赖（进程、服务、库、硬件等）\n\n` +
          `## 组件分解\n- 组件/子系统列表\n- 关键接口\n\n` +
          `## 架构图（可选）\n\n\`\`\`mermaid\n%% 在这里放 Mermaid 图（例如：graph TD）\ngraph TD\n  A[Component A] --> B[Component B]\n\`\`\`\n`
        );
      case "modules":
        return (
          header +
          `# ${meta.title}\n\n` +
          `按模块列出：职责、入口点、关键 API、依赖、常见风险。\n\n` +
          `## 模块清单\n- [ ] 模块 A\n- [ ] 模块 B\n\n` +
          `## 模块间依赖关系（mermaid）\n\n\`\`\`mermaid\n%% 在这里放 Mermaid 图（例如：flowchart LR）\nflowchart LR\n  A[Module A] --> B[Module B]\n\`\`\`\n\n` +
          `## 模块模板\n- **职责**：\n- **入口**：\n- **关键数据**：\n- **信任假设**：\n- **高风险点**：\n- **代码证据**：\n`
        );
      case "dataflow":
        return (
          header +
          `# ${meta.title}\n\n` +
          `聚焦“可控输入 -> 关键处理 -> 敏感 sink”的端到端路径。\n\n` +
          `## 关键数据对象\n- 认证令牌\n- 配置/策略\n- IPC 消息\n\n` +
          `## 数据流图\n\n\`\`\`mermaid\n%% 在这里放 Mermaid 图（例如：flowchart TD）\nflowchart TD\n  A[Source] --> B[Transform] --> C[Sink]\n\`\`\`\n`
        );
      case "trust-boundaries":
        return (
          header +
          `# ${meta.title}\n\n` +
          `列出边界类型、穿越点、校验逻辑与可利用假设。\n\n` +
          `## 信任边界图（mermaid）\n\n\`\`\`mermaid\n%% 在这里放 Mermaid 图（例如：flowchart TD）\nflowchart TD\n  A[Untrusted] -->|Boundary| B[Trusted]\n\`\`\`\n\n` +
          `## 边界清单\n- 进程边界\n- 权限边界\n- 网络边界\n- 用户态/内核态\n\n` +
          `## 穿越点模板\n- **边界**：\n- **入口**：\n- **校验/鉴权**：\n- **失败模式**：\n- **代码证据**：\n`
        );
      case "attack-surface":
        return (
          header +
          `# ${meta.title}\n\n` +
          `## 对外暴露面\n- 网络接口\n- IPC\n- 文件/设备\n- 插件/扩展点\n\n` +
          `## 测试清单\n- [ ] 输入验证\n- [ ] 权限校验\n- [ ] 序列化/反序列化\n- [ ] 资源耗尽\n`
        );
      default:
        return header + `# ${meta.title}\n\n`;
    }
  }

  private async _ensureWikiInitialized(): Promise<void> {
    this._state.wiki.status = "loading";
    this._state.wiki.error = "";
    this._syncState();

    const root = this._getWorkspaceRootUri();
    if (!root) {
      this._state.wiki.status = "error";
      this._state.wiki.error = "No workspace folder found.";
      this._syncState();
      return;
    }

    this._state.wiki.workspaceRoot = root.fsPath;

    this._ensureWikiWatcher(root);

    const wikiDir = this._wikiDir(root);
    await vscode.workspace.fs.createDirectory(wikiDir);

    const indexUri = this._wikiIndexUri(root);
    if (!(await this._exists(indexUri))) {
      const index = this._defaultWikiIndex();
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(indexUri, encoder.encode(JSON.stringify(index, null, 2)));

      for (const page of index.pages) {
        const pageUri = this._wikiPageUri(root, page.path);
        if (!(await this._exists(pageUri))) {
          await vscode.workspace.fs.writeFile(
            pageUri,
            encoder.encode(this._defaultWikiPageContent(page))
          );
        }
      }
    }

    this._state.wiki.status = "idle";
    this._syncState();
  }

  private _ensureWikiWatcher(root: vscode.Uri) {
    const key = root.fsPath;
    if (this._wikiWatchers.has(key)) return;

    const pattern = new vscode.RelativePattern(root, ".deepsight/wiki/**");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const scheduleRefresh = () => {
      if (this._wikiRefreshTimer) {
        clearTimeout(this._wikiRefreshTimer);
      }
      this._wikiRefreshTimer = setTimeout(async () => {
        try {
          // Keep UI in sync with disk edits
          await this._refreshWikiPages();
          if (this._state.page === "wiki" && this._state.wiki.currentPath) {
            await this._openWikiPage(this._state.wiki.currentPath);
          }
        } catch {
          // ignore
        }
      }, 200);
    };

    watcher.onDidChange(scheduleRefresh);
    watcher.onDidCreate(scheduleRefresh);
    watcher.onDidDelete(scheduleRefresh);

    this._wikiWatchers.set(key, watcher);
  }

  private async _loadWikiIndex(root: vscode.Uri): Promise<{ version: number; pages: WikiPageMeta[] }> {
    const indexUri = this._wikiIndexUri(root);
    const bytes = await vscode.workspace.fs.readFile(indexUri);
    const text = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(text);
    const pages = Array.isArray(parsed?.pages) ? (parsed.pages as WikiPageMeta[]) : [];
    return { version: Number(parsed?.version || 1), pages };
  }

  private async _writeWikiIndex(root: vscode.Uri, index: { version: number; pages: WikiPageMeta[] }): Promise<void> {
    const indexUri = this._wikiIndexUri(root);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(indexUri, encoder.encode(JSON.stringify(index, null, 2)));
  }

  private async _refreshWikiPages(): Promise<void> {
    const root = this._getWorkspaceRootUri();
    if (!root) {
      this._state.wiki.status = "error";
      this._state.wiki.error = "No workspace folder found.";
      this._syncState();
      return;
    }
    await this._ensureWikiInitialized();
    const index = await this._loadWikiIndex(root);
    this._state.wiki.pages = [...index.pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this._state.wiki.status = "idle";
    this._syncState();
  }

  private async _openWikiPage(relativePath: string): Promise<void> {
    const root = this._getWorkspaceRootUri();
    if (!root) return;
    await this._ensureWikiInitialized();

    const safePath = relativePath.trim();
    if (!safePath) return;

    const uri = this._wikiPageUri(root, safePath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const content = new TextDecoder().decode(bytes);

    this._state.wiki.currentPath = safePath;
    this._state.wiki.content = content;
    this._state.wiki.dirty = false;
    this._state.wiki.error = "";
    this._state.wiki.status = "idle";
    this._syncState();
  }

  private async _openWikiPageInEditor(relativePath: string): Promise<void> {
    const root = this._getWorkspaceRootUri();
    if (!root) return;
    await this._ensureWikiInitialized();

    const safePath = relativePath.trim() || this._state.wiki.currentPath;
    if (!safePath) return;

    const uri = this._wikiPageUri(root, safePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  // Wiki generation state (UI only; actual generation handled in extension.ts)
  public startWikiGeneration(mode: "full" | "current") {
    this._state.wiki.generation = {
      status: "running",
      mode,
      phase: "scanning",
      pct: 0,
      message: "",
      page: "",
      error: "",
    };
    this._syncState();
  }

  public updateWikiGenerationProgress(progress: {
    phase: "scanning" | "drafting" | "writing";
    pct: number;
    message?: string;
    page?: string;
  }) {
    const pct = Math.max(0, Math.min(100, Math.floor(progress.pct)));
    this._state.wiki.generation = {
      ...this._state.wiki.generation,
      status: "running",
      phase: progress.phase,
      pct,
      message: progress.message ?? this._state.wiki.generation.message,
      page: progress.page ?? this._state.wiki.generation.page,
      error: "",
    };
    this._syncState();
  }

  public setWikiGenerationDone(message = "Done") {
    this._state.wiki.generation = {
      ...this._state.wiki.generation,
      status: "done",
      phase: this._state.wiki.generation.phase || "writing",
      pct: 100,
      message,
      page: "",
      error: "",
    };
    this._syncState();
  }

  public setWikiGenerationCanceled(message = "Canceled") {
    this._state.wiki.generation = {
      ...this._state.wiki.generation,
      status: "canceled",
      message,
      page: "",
      error: "",
    };
    this._syncState();
  }

  public setWikiGenerationError(error: string) {
    this._state.wiki.generation = {
      ...this._state.wiki.generation,
      status: "error",
      error,
      message: error,
    };
    this._syncState();
  }

  public clearWikiGeneration() {
    this._state.wiki.generation = {
      status: "idle",
      mode: "",
      phase: "",
      pct: 0,
      message: "",
      page: "",
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource};">
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
