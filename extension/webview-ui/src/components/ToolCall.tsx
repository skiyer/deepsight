import { useState, type ReactNode } from 'react';
import { BookOpen, Search, CheckCircle2, Loader2 } from 'lucide-react';

interface ToolCallProps {
  name: string;
  status: 'running' | 'done';
  info?: string;
}

const TOOL_ICONS: Record<string, ReactNode> = {
  Read: <BookOpen className="w-3.5 h-3.5" />,
  Glob: <Search className="w-3.5 h-3.5" />,
};

export function ToolCall({ name, status, info }: ToolCallProps) {
  const icon = TOOL_ICONS[name] || <Loader2 className="w-3.5 h-3.5" />;
  const [expanded, setExpanded] = useState(false);
  const maxLength = 120;
  const isLong = Boolean(info && info.length > maxLength);
  const displayInfo = info && !expanded && isLong
    ? `${info.slice(0, maxLength)}...`
    : info;

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
      {displayInfo && (
        <span
          className={`text-[var(--vscode-descriptionForeground)] font-mono flex-1 min-w-0 ${
            expanded ? 'whitespace-pre-wrap break-all' : 'overflow-hidden text-ellipsis whitespace-nowrap'
          }`}
        >
          {displayInfo}
        </span>
      )}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline flex-shrink-0"
        >
          {expanded ? '收起' : '展开'}
        </button>
      )}
      {status === 'running' ? (
        <Loader2 className="w-3 h-3 text-[#36a6ff] animate-spin-slow flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5 text-[#89d185] flex-shrink-0" />
      )}
    </div>
  );
}
