import { useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

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
  const [isDark] = useState(() => isDarkThemeBackground());

  return (
    <div
      className="relative rounded-md overflow-hidden my-4 border"
      style={{
        borderColor: isDark ? '#3b4048' : '#d0d7de',
        background: isDark ? '#282c34' : '#fafafa',
      }}
    >
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language || undefined}
          style={isDark ? atomOneDark : atomOneLight}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            padding: '14px 16px',
            fontSize: '13px',
            background: 'transparent',
            fontFamily: 'var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
            lineHeight: '1.6',
          }}
          codeTagProps={{ style: { background: 'transparent' } }}
          showLineNumbers={false}
          wrapLongLines={false}
        >
          {code.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
