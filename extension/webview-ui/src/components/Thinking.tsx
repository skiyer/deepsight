import { useState } from 'react';

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
    <div className="thinking">
      <div
        className="thinking-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="thinking-icon">💭</span>
        <span className="thinking-label">思考过程</span>
        <span className={`thinking-toggle ${isExpanded ? 'expanded' : ''}`}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      <div className={`thinking-content ${isExpanded ? 'expanded' : ''}`}>
        {isExpanded ? content : preview}
      </div>
    </div>
  );
}
