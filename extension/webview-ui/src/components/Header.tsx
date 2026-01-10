interface HeaderProps {
  anchor: string;
  mode: 'explain' | 'audit';
}

export function Header({ anchor, mode }: HeaderProps) {
  const modeLabel = mode === 'explain' ? '✨ 解释' : '🛡️ 审计';
  const modeClass = mode === 'explain' ? 'explain' : 'audit';

  return (
    <div className="header">
      <span className="header-icon">📍</span>
      <span className="header-anchor" title={anchor}>{anchor}</span>
      <span className={`header-badge ${modeClass}`}>{modeLabel}</span>
    </div>
  );
}
