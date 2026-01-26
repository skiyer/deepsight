import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

function parseRgbOrHex(input: string): { r: number; g: number; b: number } | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  // #rgb or #rrggbb
  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return { r, g, b };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return { r, g, b };
    }
    return null;
  }

  // rgb(...) / rgba(...)
  const m = raw.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1]
      .split(',')
      .map((p) => p.trim())
      .slice(0, 3)
      .map((p) => Number(p));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [r, g, b] = parts;
    return { r, g, b };
  }

  return null;
}

function isDarkThemeBackground(): boolean {
  try {
    const bg = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim();
    const rgb = parseRgbOrHex(bg);
    if (!rgb) return true;
    // Relative luminance approximation
    const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
    return luma < 128;
  } catch {
    return true;
  }
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [isDark] = useState(() => isDarkThemeBackground());

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="relative rounded-md overflow-hidden my-3 border border-[var(--vscode-panel-border)]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--vscode-editorWidget-background)] border-b border-[var(--vscode-panel-border)]">
        {language ? (
          <span className="text-[11px] text-[var(--vscode-descriptionForeground)] uppercase tracking-wide font-medium">
            {language}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-[var(--vscode-descriptionForeground)] rounded transition-colors hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-[#89d185]" />
              <span className="text-[#89d185]">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || undefined}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          padding: '12px 14px',
          fontSize: '12.5px',
          background: 'var(--vscode-textCodeBlock-background)',
          color: 'var(--vscode-editor-foreground, var(--vscode-foreground))',
          fontFamily: 'var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
          lineHeight: '1.55',
        }}
        showLineNumbers={false}
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  );
}
