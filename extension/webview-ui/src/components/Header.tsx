import { MapPin, Sparkles, Shield } from 'lucide-react';

interface HeaderProps {
  anchor: string;
  mode: 'explain' | 'audit';
}

export function Header({ anchor, mode }: HeaderProps) {
  const isExplain = mode === 'explain';

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] sticky top-0 z-10">
      <MapPin className="w-3.5 h-3.5 text-[var(--vscode-foreground)] opacity-70 flex-shrink-0" />
      <span
        className="flex-1 font-semibold text-[var(--vscode-textLink-foreground)] overflow-hidden text-ellipsis whitespace-nowrap"
        title={anchor}
      >
        {anchor}
      </span>
      <span
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full
          ${isExplain
            ? 'bg-[#d97706]/15 text-[#d97706]'
            : 'bg-[#36a6ff]/15 text-[#36a6ff]'
          }
        `}
      >
        {isExplain ? (
          <>
            <Sparkles className="w-3 h-3" />
            解释
          </>
        ) : (
          <>
            <Shield className="w-3 h-3" />
            审计
          </>
        )}
      </span>
    </div>
  );
}
