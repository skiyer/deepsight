import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface CodeBlockProps {
  language: string;
  code: string;
}

// Map common Markdown language aliases to highlight.js language ids.
// Anything unknown should fall back to plain text, otherwise highlight.js will
// try to auto-detect and produce "random" keyword highlighting.
const LANGUAGE_ALIASES: Record<string, string> = {
  // common shorthands
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',

  // plaintext
  plain: 'text',
  plaintext: 'text',
  txt: 'text',
};

const SUPPORTED_LANGUAGES = new Set<string>(
  ((((SyntaxHighlighter as any).supportedLanguages as string[] | undefined) ?? [])
    .map((l) => String(l).toLowerCase()))
);

function normalizeLanguage(input: string): string {
  const raw = (input || '').trim().toLowerCase();
  if (!raw) return 'text';

  const mapped = LANGUAGE_ALIASES[raw] ?? raw;
  if (mapped === 'text') return 'text';

  // If highlight.js doesn't know this language, don't fall back to auto-detect.
  // Auto-detect is exactly what causes the odd keyword highlighting.
  if (SUPPORTED_LANGUAGES.size && !SUPPORTED_LANGUAGES.has(mapped)) {
    return 'text';
  }

  return mapped;
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
  const isDark = isDarkThemeBackground();

  // IMPORTANT: When language is empty/unknown, force "text".
  // Otherwise react-syntax-highlighter/highlight.js will auto-detect the language,
  // which causes random keyword highlighting for plain code blocks (``` ... ```).
  const effectiveLanguage = normalizeLanguage(language);

  // Preserve indentation. Only strip the trailing newline that Markdown parsers
  // commonly include in fenced code blocks.
  const codeString = code.replace(/\n$/, '');

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
          language={effectiveLanguage}
          style={isDark ? atomOneDark : atomOneLight}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            padding: '14px 16px',
            fontSize: '13px',
            background: 'transparent',
            fontFamily:
              'var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
            lineHeight: '1.6',
          }}
          codeTagProps={{ style: { background: 'transparent' } }}
          showLineNumbers={false}
          wrapLongLines={false}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
