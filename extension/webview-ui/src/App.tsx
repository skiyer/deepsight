import { useState, useEffect } from 'react';
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

  return (
    <div className="flex flex-col min-h-screen">
      <Header anchor={state.anchor} mode={state.mode} />
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        {/* Render all blocks in order */}
        {state.blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} />
        ))}

        {/* Show skeleton when loading (no blocks yet) */}
        {isLoading && !hasBlocks && <Skeleton />}
      </div>
    </div>
  );
}
