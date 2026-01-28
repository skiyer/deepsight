import { Loader2, MapPin, Sparkles, Shield, Square } from 'lucide-react';

type PageMode = 'analysis' | 'wiki';

type WikiGenerationStatus = 'idle' | 'running' | 'done' | 'error' | 'canceled';

type WikiGenerationPhase = 'scanning' | 'drafting' | 'writing' | '';

interface HeaderProps {
  page: PageMode;
  onNavigate: (page: PageMode) => void;
  anchor: string;
  mode: 'explain' | 'audit';

  // Wiki actions
  wikiGeneration?: {
    status: WikiGenerationStatus;
    phase?: WikiGenerationPhase;
    pct?: number;
    message?: string;
    page?: string;
  };
  onWikiGenerateAll?: () => void;
  onWikiCancelGeneration?: () => void;
}

export function Header({
  page,
  onNavigate,
  anchor,
  mode,
  wikiGeneration,
  onWikiGenerateAll,
  onWikiCancelGeneration,
}: HeaderProps) {
  const isExplain = mode === 'explain';

  const tabClass = (active: boolean) =>
    [
      'px-2.5 py-1 text-xs rounded',
      active
        ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
        : 'bg-transparent text-[var(--vscode-foreground)] opacity-80 hover:opacity-100',
    ].join(' ');

  const isWiki = page === 'wiki';
  const isWikiGenerating = isWiki && wikiGeneration?.status === 'running';
  const wikiPct = Math.max(0, Math.min(100, Math.floor(wikiGeneration?.pct ?? 0)));

  const formatWikiPhase = (phase: WikiGenerationPhase) => {
    switch (phase) {
      case 'scanning':
        return '扫描中';
      case 'drafting':
        return '生成中';
      case 'writing':
        return '写入中';
      default:
        return '';
    }
  };

  const wikiProgressLabel =
    (wikiGeneration?.message || '').trim() ||
    [formatWikiPhase(wikiGeneration?.phase ?? ''), wikiGeneration?.page].filter(Boolean).join(' · ') ||
    '生成中…';

  return (
    <div className="sticky top-0 z-10">
      {/* Main header row */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]">
        <div className="flex items-center gap-1 bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-panel-border)] rounded p-0.5">
          <button className={tabClass(page === 'analysis')} onClick={() => onNavigate('analysis')}>
            Analysis
          </button>
          <button className={tabClass(page === 'wiki')} onClick={() => onNavigate('wiki')}>
            Wiki
          </button>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {page === 'analysis' && (
            <>
              <MapPin className="w-3.5 h-3.5 text-[var(--vscode-foreground)] opacity-70 flex-shrink-0" />
              <span
                className="flex-1 font-semibold text-[var(--vscode-textLink-foreground)] overflow-hidden text-ellipsis whitespace-nowrap"
                title={anchor}
              >
                {anchor}
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
          <div className="flex items-center gap-2">
            {isWikiGenerating ? (
              <button
                onClick={onWikiCancelGeneration}
                className="inline-flex items-center justify-center w-7 h-7 rounded text-[var(--vscode-foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--vscode-toolbar-hoverBackground)] transition-all"
                title="停止生成"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            ) : null}

            <button
              onClick={onWikiGenerateAll}
              disabled={isWikiGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              title="生成所有 Wiki 页面"
            >
              {isWikiGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin-slow" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>生成所有</span>
            </button>
          </div>
        )}
      </div>

      {/* Progress row (only when generating) */}
      {isWikiGenerating ? (
        <div className="border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]">
          <div className="px-4 py-2 flex items-center gap-2 text-xs text-[var(--vscode-descriptionForeground)]">
            <Loader2 className="w-4 h-4 animate-spin-slow" />
            <span className="flex-1 min-w-0 truncate" title={wikiProgressLabel}>
              {wikiProgressLabel}
            </span>
            <span className="tabular-nums">{wikiPct}%</span>
          </div>
          <div className="px-4 pb-2">
            <div className="h-1.5 w-full rounded bg-[var(--vscode-panel-border)] overflow-hidden">
              <div
                className="h-full bg-[var(--vscode-textLink-foreground)] transition-[width] duration-200 ease-out animate-pulse-slow"
                style={{ width: `${wikiPct}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
