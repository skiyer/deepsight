import { useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';

interface ThinkingProps {
  content: string;
}

export function Thinking({ content }: ThinkingProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) {
    return null;
  }

  // Truncate for preview
  const preview = content.length > 100
    ? content.substring(0, 100) + '...'
    : content;

  return (
    <div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-lg overflow-hidden mb-3 animate-fade-in">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors hover:bg-[var(--vscode-list-hoverBackground)]"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Brain className="w-3.5 h-3.5 text-[var(--vscode-descriptionForeground)]" />
        <span className="text-xs font-medium text-[var(--vscode-descriptionForeground)] flex-1">思考过程</span>
        <ChevronRight
          className={`w-3.5 h-3.5 text-[var(--vscode-descriptionForeground)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
      </div>
      <div
        className={`
          px-3 pb-3 text-xs text-[var(--vscode-descriptionForeground)] leading-relaxed
          overflow-hidden transition-all duration-300
          ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-20 opacity-70'}
        `}
      >
        {isExpanded ? content : preview}
      </div>
    </div>
  );
}
