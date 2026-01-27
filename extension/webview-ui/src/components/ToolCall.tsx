import type { ReactNode } from 'react';
import { BookOpen, Search, Shell, FileEdit, Globe, CheckCircle2, Loader2, FileSearch } from 'lucide-react';

interface ToolCallProps {
  name: string;
  status: 'running' | 'done';
  info?: string;
}

const TOOL_ICONS: Record<string, ReactNode> = {
  Read: <BookOpen className="w-3.5 h-3.5" />,
  Glob: <Search className="w-3.5 h-3.5" />,
  Grep: <FileSearch className="w-3.5 h-3.5" />,
  Bash: <Shell className="w-3.5 h-3.5" />,
  Write: <FileEdit className="w-3.5 h-3.5" />,
  Edit: <FileEdit className="w-3.5 h-3.5" />,
  WebFetch: <Globe className="w-3.5 h-3.5" />,
  WebSearch: <Search className="w-3.5 h-3.5" />,
};

export function ToolCall({ name, status, info }: ToolCallProps) {
  const icon = TOOL_ICONS[name] || <Loader2 className="w-3.5 h-3.5" />;

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 bg-[var(--vscode-editor-background)]
        border border-[var(--vscode-panel-border)]
        rounded-md text-xs animate-fade-in
        ${status === 'running' ? 'border-l-2 border-l-[#36a6ff]' : 'border-l-2 border-l-[#89d185]'}
      `}
    >
      <span className="text-[var(--vscode-foreground)] flex-shrink-0">{icon}</span>
      <span className="font-semibold text-[var(--vscode-foreground)] flex-shrink-0">{name}</span>
      {info && (
        <span className="text-[var(--vscode-descriptionForeground)] font-mono overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">
          {info}
        </span>
      )}
      {status === 'running' ? (
        <Loader2 className="w-3 h-3 text-[#36a6ff] animate-spin-slow flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5 text-[#89d185] flex-shrink-0" />
      )}
    </div>
  );
}
