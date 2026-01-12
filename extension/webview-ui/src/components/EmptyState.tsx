import { Sparkles, Shield } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-5 text-center">
      <div className="text-5xl mb-4 opacity-60">✨</div>
      <div className="text-base font-semibold text-[var(--vscode-foreground)] mb-2">DeepSight</div>
      <div className="text-sm text-[var(--vscode-descriptionForeground)] mb-6">
        AI 驱动的代码分析工具
      </div>
      <div className="px-4 py-3 bg-[var(--vscode-textCodeBlock-background)] rounded-md text-xs text-[var(--vscode-descriptionForeground)]">
        点击代码上方的{' '}
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#36a6ff]/15 text-[#36a6ff] rounded text-xs font-medium">
          <Sparkles className="w-3 h-3" />
          解释
        </span>
        {' '}
        或{' '}
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#d97706]/15 text-[#d97706] rounded text-xs font-medium">
          <Shield className="w-3 h-3" />
          审计
        </span>
        {' '}按钮开始分析
      </div>
    </div>
  );
}
