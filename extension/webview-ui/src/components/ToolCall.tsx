interface ToolCallProps {
  name: string;
  status: 'running' | 'done';
  info?: string;
}

const TOOL_ICONS: Record<string, string> = {
  Read: '📖',
  Glob: '🔍',
  Grep: '🔎',
  Bash: '💻',
  Write: '✏️',
  Edit: '✂️',
  WebFetch: '🌐',
  WebSearch: '🔍',
};

export function ToolCall({ name, status, info }: ToolCallProps) {
  const icon = TOOL_ICONS[name] || '🔧';

  return (
    <div className={`tool-call ${status}`}>
      <span className="tool-call-icon">{icon}</span>
      <span className="tool-call-name">{name}</span>
      {info && <span className="tool-call-info">{info}</span>}
      {status === 'running' && <span className="tool-call-spinner" />}
      {status === 'done' && <span className="tool-call-done">✓</span>}
    </div>
  );
}
