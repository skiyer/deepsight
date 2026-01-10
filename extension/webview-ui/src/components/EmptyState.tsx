export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">🔍</div>
      <div className="empty-state-title">DeepSight</div>
      <div className="empty-state-description">
        AI 驱动的代码分析工具
      </div>
      <div className="empty-state-hint">
        点击代码上方的 <strong>✨ 解释</strong> 或 <strong>🛡️ 审计</strong> 按钮开始分析
      </div>
    </div>
  );
}
