import { BookOpen, ExternalLink, MapPin, Sparkles, Shield } from 'lucide-react';

type PageMode = 'analysis' | 'wiki';

interface HeaderProps {
  page: PageMode;
  onNavigate: (page: PageMode) => void;
  anchor: string;
  mode: 'explain' | 'audit';

  wikiTitle?: string;
  onOpenWikiInEditor?: () => void;
}

export function Header({ page, onNavigate, anchor, mode, wikiTitle, onOpenWikiInEditor }: HeaderProps) {
  const isExplain = mode === 'explain';

  const tabClass = (active: boolean) =>
    [
      'px-2.5 py-1 text-xs rounded',
      active
        ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
        : 'bg-transparent text-[var(--vscode-foreground)] opacity-80 hover:opacity-100',
    ].join(' ');

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] sticky top-0 z-10">
      <div className="flex items-center gap-1 bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-panel-border)] rounded p-0.5">
        <button className={tabClass(page === 'analysis')} onClick={() => onNavigate('analysis')}>
          Analysis
        </button>
        <button className={tabClass(page === 'wiki')} onClick={() => onNavigate('wiki')}>
          Wiki
        </button>
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {page === 'analysis' ? (
          <>
            <MapPin className="w-3.5 h-3.5 text-[var(--vscode-foreground)] opacity-70 flex-shrink-0" />
            <span
              className="flex-1 font-semibold text-[var(--vscode-textLink-foreground)] overflow-hidden text-ellipsis whitespace-nowrap"
              title={anchor}
            >
              {anchor}
            </span>
          </>
        ) : (
          <>
            <BookOpen className="w-3.5 h-3.5 text-[var(--vscode-foreground)] opacity-70 flex-shrink-0" />
            <span
              className="flex-1 font-semibold text-[var(--vscode-textLink-foreground)] overflow-hidden text-ellipsis whitespace-nowrap"
              title={wikiTitle || 'Wiki'}
            >
              {wikiTitle || 'Wiki'}
            </span>
          </>
        )}
      </div>

      {page === 'analysis' ? (
        <span
          className={`
            inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full
            ${isExplain ? 'bg-[#d97706]/15 text-[#d97706]' : 'bg-[#36a6ff]/15 text-[#36a6ff]'}
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
      ) : (
        <button
          onClick={onOpenWikiInEditor}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]"
          title="Open wiki page in VS Code editor"
        >
          <ExternalLink className="w-3 h-3" />
          在编辑器中打开
        </button>
      )}
    </div>
  );
}
