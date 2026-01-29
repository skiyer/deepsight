import React, { useState, useEffect, useRef } from 'react';
import { FileEdit } from 'lucide-react';
import { Header } from './components/Header';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { Skeleton } from './components/Skeleton';
import { EmptyState } from './components/EmptyState';
import { ToolCall } from './components/ToolCall';
import { Thinking } from './components/Thinking';
import type { PageMode, WikiGenerationState } from './types';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): ViewState | undefined;
  setState(state: ViewState): void;
}

// Block types
interface BaseBlock {
  id: string;
  status: 'streaming' | 'done';
}

interface TextBlock extends BaseBlock {
  type: 'text';
  content: string;
}

interface ToolBlock extends BaseBlock {
  type: 'tool';
  name: string;
  info?: string;
}

interface ThinkingBlock extends BaseBlock {
  type: 'thinking';
  content: string;
}

type ContentBlock = TextBlock | ToolBlock | ThinkingBlock;

interface ViewState {
  status: 'empty' | 'loading' | 'streaming' | 'done' | 'error';
  anchor: string;
  mode: 'explain' | 'audit';
  blocks: ContentBlock[];
  error: string;

  page: PageMode;
  wiki: WikiState;
}

type WikiPageType =
  | 'home'
  | 'architecture'
  | 'modules'
  | 'dataflow'
  | 'trust-boundaries'
  | 'attack-surface'
  | 'custom';

interface WikiPageMeta {
  path: string;
  title: string;
  type: WikiPageType;
  order: number;
}

interface WikiState {
  status: 'idle' | 'loading' | 'error';
  pages: WikiPageMeta[];
  currentPath: string;
  content: string;
  error: string;

  generation: WikiGenerationState;
}

const initialState: ViewState = {
  status: 'empty',
  anchor: '',
  mode: 'explain',
  blocks: [],
  error: '',

  page: 'analysis',
  wiki: {
    status: 'idle',
    pages: [],
    currentPath: '',
    content: '',
    error: '',
    generation: {
      status: 'idle',
      phase: '',
      pct: 0,
      message: '',
      page: '',
      error: '',
    },
  },
};

interface AppProps {
  vscode: VsCodeApi;
}

// Block renderer component
function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'text':
      return (
        <div className="animate-fade-in" data-status={block.status}>
          <MarkdownRenderer content={block.content} />
        </div>
      );

    case 'tool':
      return (
        <div className="animate-fade-in" data-status={block.status}>
          <ToolCall
            name={block.name}
            status={block.status === 'streaming' ? 'running' : 'done'}
            info={block.info}
          />
        </div>
      );

    case 'thinking':
      return (
        <div className="animate-fade-in" data-status={block.status}>
          <Thinking content={block.content} />
        </div>
      );

    default:
      return null;
  }
}

export default function App({ vscode }: AppProps) {
  // 优先从 getState 恢复（WebView 内容销毁前保存的状态）
  const [state, setState] = useState<ViewState>(() => {
    const savedState = vscode.getState() as unknown;
    const saved =
      typeof savedState === 'object' && savedState !== null
        ? (savedState as Record<string, unknown>)
        : null;

    // Migration: if old format detected (has 'content' field), reset to initial
    if (saved && 'content' in saved && !('blocks' in saved)) {
      return initialState;
    }

    // Migration: older versions without wiki/page
    if (saved && !('page' in saved)) {
      const merged = { ...initialState, ...(saved as Partial<ViewState>) } as ViewState;
      return merged;
    }

    const candidate = (savedState as ViewState) || initialState;

    // Migration: older versions without wiki.generation
    const wikiAny = (candidate as any).wiki as Partial<WikiState> | undefined;
    if (!wikiAny || !(wikiAny as any).generation) {
      return {
        ...candidate,
        wiki: {
          ...initialState.wiki,
          ...(wikiAny || {}),
          generation: initialState.wiki.generation,
        },
      } as ViewState;
    }

    return candidate;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);

  const [wikiSidebarWidth, setWikiSidebarWidth] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem('deepsight_wiki_sidebar_width');
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? n : 120;
    } catch {
      return 260;
    }
  });

  // Dismissible toast states for wiki page
  const [dismissedCanceled, setDismissedCanceled] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);

  // Auto-reset dismissed states when status changes
  useEffect(() => {
    if (state.wiki.generation.status !== 'canceled') {
      setDismissedCanceled(false);
    }
    if (state.wiki.generation.status !== 'error') {
      setDismissedError(false);
    }
  }, [state.wiki.generation.status]);

  // Auto-dismiss error toast after 5 seconds
  useEffect(() => {
    if (state.wiki.generation.status === 'error' && !dismissedError) {
      const timer = setTimeout(() => {
        setDismissedError(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.wiki.generation.status, dismissedError]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      // Handle complete state sync from Extension
      if (message.type === 'state_sync' && message.state) {
        setState(message.state);
        // 同步保存到 WebView 本地存储，下次重建时可快速恢复
        vscode.setState(message.state);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  // Wiki: request page list when entering wiki mode
  useEffect(() => {
    if (state.page !== 'wiki') return;
    if (state.wiki.pages.length) return;
    vscode.postMessage({ type: 'wiki_list' });
  }, [state.page, state.wiki.pages.length, vscode]);

  // Auto-scroll when new content is added during streaming
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || autoScrollPaused) return;
    if (state.status !== 'streaming') return;

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [state.blocks, state.status, autoScrollPaused]);

  const handleScroll = () => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const threshold = 50;

    if (distanceToBottom > threshold) {
      setAutoScrollPaused(true);
    } else {
      setAutoScrollPaused(false);
    }
  };

  // Wiki UI local state (editor/preview/search)
  // Wiki is read-only in Webview; users edit files directly in VS Code.

  const splitFrontMatter = (markdown: string): { frontMatter: string; body: string } => {
    if (!markdown.startsWith('---')) return { frontMatter: '', body: markdown };
    const lines = markdown.split('\n');
    if (lines.length < 3) return { frontMatter: '', body: markdown };
    if (lines[0].trim() !== '---') return { frontMatter: '', body: markdown };

    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        end = i;
        break;
      }
    }
    if (end === -1) return { frontMatter: '', body: markdown };

    const frontMatter = lines.slice(1, end).join('\n').trim();
    const body = lines.slice(end + 1).join('\n').replace(/^\n+/, '');
    return { frontMatter, body };
  };

  const parseFrontMatter = (frontMatter: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const line of frontMatter.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf(':');
      if (idx === -1) continue;
      let key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();

      // Format time fields (ISO 8601 format)
      if ((key === 'updated' || key === 'created') && value) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          value = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
      }

      if (key) out[key] = value;
    }
    return out;
  };

  const navigate = (page: PageMode) => {
    vscode.postMessage({ type: 'navigate', page });
  };

  const openWikiPage = (path: string) => {
    vscode.postMessage({ type: 'wiki_open', path });
  };

  const openWikiInEditor = () => {
    if (!state.wiki.currentPath) return;
    vscode.postMessage({ type: 'wiki_open_in_editor', path: state.wiki.currentPath });
  };

  const generateWiki = () => {
    vscode.postMessage({ type: 'wiki_generate' });
  };

  const cancelWikiGeneration = () => {
    vscode.postMessage({ type: 'wiki_cancel_generation' });
  };

  const wikiGen = state.wiki.generation;

  const isLoading = state.status === 'loading';
  const hasBlocks = state.blocks.length > 0;
  const isStreaming = state.status === 'streaming';

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const beginResizeWikiSidebar = (e: React.MouseEvent) => {
    if (state.page !== 'wiki') return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = wikiSidebarWidth;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const next = clamp(startWidth + dx, 120, 520);
      setWikiSidebarWidth(next);
      try {
        window.localStorage.setItem('deepsight_wiki_sidebar_width', String(next));
      } catch {
        // ignore
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header
        page={state.page}
        onNavigate={navigate}
        anchor={state.anchor}
        mode={state.mode}
        wikiGeneration={state.wiki.generation}
        onWikiGenerateAll={generateWiki}
        onWikiCancelGeneration={cancelWikiGeneration}
      />

      {state.page === 'wiki' ? (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Sidebar */}
          <div
            className="border-r border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] flex flex-col"
            style={{ width: `${wikiSidebarWidth}px` }}
          >
            <div className="flex-1 overflow-y-auto">
              {(state.wiki.pages || []).map((p) => {
                  const active = p.path === state.wiki.currentPath;
                  return (
                    <div
                      key={p.path}
                      className={
                        'px-3 py-2 text-sm cursor-pointer border-l-2 ' +
                        (active
                          ? 'border-l-[var(--vscode-textLink-foreground)] bg-[var(--vscode-list-activeSelectionBackground)]'
                          : 'border-l-transparent hover:bg-[var(--vscode-list-hoverBackground)]')
                      }
                      onClick={() => openWikiPage(p.path)}
                      title={p.path}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.title}</div>
                        <div className="text-xs opacity-70 truncate">{p.type}</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Resize handle */}
          <div
            role="separator"
            aria-orientation="vertical"
            className="w-1 cursor-col-resize bg-transparent hover:bg-[var(--vscode-panel-border)]"
            onMouseDown={beginResizeWikiSidebar}
            title="Drag to resize"
          />

          {/* Main */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              {!state.wiki.currentPath ? (
                <div className="h-full overflow-y-auto">
                  {/* Page load error */}
                  {state.wiki.status === 'error' && state.wiki.error && (
                    <div className="m-6 px-3 py-2 rounded bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-inputValidation-errorForeground)] text-xs">
                      {state.wiki.error}
                    </div>
                  )}
                  <div className="p-6 text-sm opacity-70">Select a wiki page from the left.</div>
                </div>
              ) : (
                (() => {
                  const { frontMatter, body } = splitFrontMatter(state.wiki.content || '');
                  const meta = frontMatter ? parseFrontMatter(frontMatter) : {};
                  const hasMeta = Object.keys(meta).length > 0;
                  return (
                    <div className="h-full overflow-y-auto">
                      {/* Error toast */}
                      {wikiGen.status === 'error' && wikiGen.error && !dismissedError && (
                        <div className="mx-6 mt-4 px-3 py-2 rounded bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-inputValidation-errorForeground)] text-xs flex items-center justify-between gap-3">
                          <span className="truncate" title={wikiGen.error}>{wikiGen.error}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={generateWiki} className="hover:underline">Retry</button>
                            <button onClick={() => setDismissedError(true)} className="opacity-60 hover:opacity-100">×</button>
                          </div>
                        </div>
                      )}

                      {/* Canceled toast */}
                      {wikiGen.status === 'canceled' && !dismissedCanceled && (
                        <div className="mx-6 mt-4 px-3 py-2 rounded bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-inputValidation-warningForeground)] text-xs flex items-center justify-between gap-3">
                          <span>Canceled</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={generateWiki} className="hover:underline">Retry</button>
                            <button onClick={() => setDismissedCanceled(true)} className="opacity-60 hover:opacity-100">×</button>
                          </div>
                        </div>
                      )}

                      <div className="px-6 py-4 flex flex-col gap-3">
                        {/* Metadata and Edit button row */}
                        <div className="flex items-center justify-between">
                          {hasMeta ? (
                            <details className="text-[11px] text-[var(--vscode-descriptionForeground)]">
                              <summary className="cursor-pointer select-none inline-flex items-center gap-2 hover:text-[var(--vscode-foreground)] transition-colors">
                                <span className="opacity-60">Metadata</span>
                                <span className="opacity-40">·</span>
                                <span className="opacity-60">{Object.keys(meta).length} fields</span>
                              </summary>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                {Object.entries(meta).map(([k, v]) => (
                                  <span key={k} className="inline-flex items-center gap-1">
                                    <span className="opacity-50">{k}:</span>
                                    <span className="font-mono opacity-80">{v}</span>
                                  </span>
                                ))}
                              </div>
                            </details>
                          ) : <div />}

                          {/* Edit button - aligned with metadata */}
                          <button
                            onClick={openWikiInEditor}
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)]/60 text-[var(--vscode-foreground)] opacity-60 hover:opacity-100 transition-opacity"
                            title="Open in Editor"
                            aria-label="Open in Editor"
                          >
                            <FileEdit className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </div>

                        <div className="max-w-[900px]">
                          <MarkdownRenderer content={body} />
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Render based on analysis state */}
          {state.status === 'empty' ? (
            <EmptyState />
          ) : state.status === 'error' ? (
            <div className="flex flex-col items-center justify-center min-h-screen p-10 text-center">
              <div className="text-2xl mb-3">✕</div>
              <div className="text-[var(--vscode-errorForeground)] p-4 bg-[var(--vscode-inputValidation-errorBackground)] border border-[var(--vscode-inputValidation-errorBorder)] rounded-md max-w-[400px] word-break">
                {state.error}
              </div>
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex-1 min-h-0 p-4 overflow-y-auto flex flex-col gap-4"
              onScroll={handleScroll}
            >
              {/* Auto-scroll paused indicator */}
              {autoScrollPaused && isStreaming && (
                <div className="fixed bottom-4 right-4 z-10">
                  <button
                    onClick={() => {
                      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
                      setAutoScrollPaused(false);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded shadow-lg hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    回到最新内容
                  </button>
                </div>
              )}

              {/* Render all blocks in order */}
              {state.blocks.map((block) => (
                <BlockRenderer key={block.id} block={block} />
              ))}

              {/* Status indicator */}
              {isStreaming ? (
                <div className="flex items-center gap-2 text-xs text-[var(--vscode-descriptionForeground)] animate-pulse-slow">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>思考中...</span>
                </div>
              ) : state.status === 'done' && hasBlocks ? (
                <div className="flex items-center gap-2 text-xs text-[var(--vscode-terminal-foreground)]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>已完成</span>
                </div>
              ) : null}

              {/* Show skeleton when loading (no blocks yet) */}
              {isLoading && !hasBlocks && <Skeleton />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
