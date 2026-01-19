import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { Skeleton } from './components/Skeleton';
import { EmptyState } from './components/EmptyState';
import { ToolCall } from './components/ToolCall';
import { Thinking } from './components/Thinking';

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
}

const initialState: ViewState = {
  status: 'empty',
  anchor: '',
  mode: 'explain',
  blocks: [],
  error: '',
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
    const savedState = vscode.getState();
    // Migration: if old format detected (has 'content' field), reset to initial
    if (savedState && 'content' in savedState && !('blocks' in savedState)) {
      return initialState;
    }
    return savedState || initialState;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);

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

  // Render based on state
  if (state.status === 'empty') {
    return <EmptyState />;
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-10 text-center">
        <div className="text-2xl mb-3">✕</div>
        <div className="text-[var(--vscode-errorForeground)] p-4 bg-[var(--vscode-inputValidation-errorBackground)] border border-[var(--vscode-inputValidation-errorBorder)] rounded-md max-w-[400px] word-break">
          {state.error}
        </div>
      </div>
    );
  }

  const isLoading = state.status === 'loading';
  const hasBlocks = state.blocks.length > 0;
  const isStreaming = state.status === 'streaming';

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header anchor={state.anchor} mode={state.mode} />
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
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
    </div>
  );
}
