import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type mermaid from 'mermaid';
import { CodeBlock } from './CodeBlock';

type MermaidTheme = 'default' | 'dark' | 'neutral';

type MermaidInstance = typeof mermaid;

let mermaidPromise: Promise<MermaidInstance> | null = null;
let lastInitializedTheme: string | null = null;

async function loadMermaid(): Promise<MermaidInstance> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default);
  }
  return mermaidPromise;
}

function detectMermaidTheme(): MermaidTheme {
  try {
    const cls = document.body?.classList;
    if (cls?.contains('vscode-light') || cls?.contains('vscode-high-contrast-light')) {
      return 'default';
    }
    return 'dark';
  } catch {
    return 'dark';
  }
}

function ensureMermaidInitialized(m: MermaidInstance, theme: MermaidTheme) {
  const mermaidTheme: MermaidTheme = theme === 'default' ? 'neutral' : 'dark';
  const themeKey = `${theme}-${mermaidTheme}`;

  if (lastInitializedTheme === themeKey) return;

  m.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: mermaidTheme,
    themeVariables: {
      fontFamily:
        'var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      fontSize: '14px',
    },
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis',
      padding: 16,
      nodeSpacing: 40,
      rankSpacing: 50,
      diagramPadding: 20,
    },
    sequence: {
      useMaxWidth: true,
      diagramMarginX: 20,
      diagramMarginY: 20,
      actorMargin: 40,
      width: 150,
      height: 65,
      boxMargin: 8,
      boxTextMargin: 4,
      noteMargin: 8,
      messageMargin: 30,
      mirrorActors: true,
      bottomMarginAdj: 1,
      rightAngles: false,
      curve: 'basis',
      padding: 8,
    },
    gantt: {
      useMaxWidth: true,
      leftPadding: 75,
      rightPadding: 20,
      topPadding: 40,
      bottomPadding: 40,
      gridLineStartPadding: 35,
      fontSize: 14,
      sectionFontSize: 16,
      numberSectionStyles: 4,
      axisFormat: '%Y-%m-%d',
    },
    class: { useMaxWidth: true, padding: 8 },
    state: { useMaxWidth: true, padding: 8 },
    pie: { useMaxWidth: true, textPosition: 0.75 },
    er: { useMaxWidth: true, padding: 16 },
    journey: { useMaxWidth: true },
    gitgraph: { useMaxWidth: true, showCommitLabel: true, rotateCommitLabel: false },
    mindmap: { useMaxWidth: true, padding: 16 },
    timeline: { useMaxWidth: true, padding: 16 },
  });

  lastInitializedTheme = themeKey;
}

// Icons
const ZoomOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7" cy="7" r="5"/>
    <path d="M11 11L14 14"/>
    <path d="M5 7H9" strokeLinecap="round"/>
  </svg>
);

const ZoomInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7" cy="7" r="5"/>
    <path d="M11 11L14 14"/>
    <path d="M5 7H9" strokeLinecap="round"/>
    <path d="M7 5V9" strokeLinecap="round"/>
  </svg>
);

const ResetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4L2 8l4 4"/>
    <path d="M10 4l4 4-4 4"/>
  </svg>
);

// Toolbar button component
function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: '6px',
        background: isPressed
          ? 'var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.25))'
          : isHovered
          ? 'var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.15))'
          : 'transparent',
        color: 'var(--vscode-foreground, #cccccc)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        transform: isPressed ? 'scale(0.92)' : 'scale(1)',
      }}
    >
      {children}
    </button>
  );
}

export function MermaidBlock({ code }: { code: string }) {
  const id = useMemo(() => `mermaid-${Math.random().toString(36).slice(2)}`, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<MermaidTheme>(() => detectMermaidTheme());
  const [error, setError] = useState<string>('');

  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const translateStartRef = useRef({ x: 0, y: 0 });

  // Detect theme changes
  useEffect(() => {
    const update = () => {
      const next = detectMermaidTheme();
      setTheme((prev) => (prev === next ? prev : next));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Render mermaid diagram
  useEffect(() => {
    let cancelled = false;
    const el = diagramRef.current;
    if (!el) return;

    el.innerHTML = '';
    setError('');
    setScale(1);
    setTranslate({ x: 0, y: 0 });

    const render = async () => {
      try {
        const m = await loadMermaid();
        if (cancelled) return;
        ensureMermaidInitialized(m, theme);
        const { svg, bindFunctions } = await m.render(id, code, el);
        if (cancelled) return;
        el.innerHTML = svg;
        bindFunctions?.(el);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        el.innerHTML = '';
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [code, id, theme]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s * 1.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s / 1.25, 0.25));
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.min(Math.max(s * delta, 0.25), 5));
    },
    []
  );

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    translateStartRef.current = { ...translate };
  }, [translate]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setTranslate({
        x: translateStartRef.current.x + dx,
        y: translateStartRef.current.y + dy,
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (error) {
    return (
      <div className="my-4">
        <div
          className="mb-2 px-3 py-2 rounded border text-xs"
          style={{
            borderColor: 'var(--md-border, #d0d7de)',
            background: 'var(--vscode-inputValidation-errorBackground, rgba(255,0,0,0.1))',
            color: 'var(--vscode-errorForeground, #f14c4c)',
          }}
        >
          Mermaid render error: {error}
        </div>
        <CodeBlock language="mermaid" code={code} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-block"
      style={{
        margin: '16px 0',
        borderRadius: '10px',
        border: '1px solid var(--mermaid-border, var(--md-border, #d0d7de))',
        background: 'var(--mermaid-bg, var(--md-code-block-bg, #fafafa))',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
    >
      {/* Floating Zoom level indicator - top left */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          padding: '4px 10px',
          borderRadius: '4px',
          background: 'var(--vscode-editor-background, #1e1e1e)',
          border: '1px solid var(--vscode-panel-border, rgba(128,128,128,0.2))',
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--vscode-foreground, #cccccc)',
          userSelect: 'none',
          zIndex: 10,
        }}
      >
        {Math.round(scale * 100)}%
      </div>

      {/* Floating Toolbar - top right */}
      <div
        className="mermaid-toolbar"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '3px',
          borderRadius: '8px',
          background: 'var(--vscode-editor-background, #1e1e1e)',
          border: '1px solid var(--vscode-panel-border, rgba(128,128,128,0.2))',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          userSelect: 'none',
          zIndex: 10,
        }}
      >
        <ToolbarButton onClick={handleZoomOut} title="Zoom Out">
          <ZoomOutIcon />
        </ToolbarButton>
        <ToolbarButton onClick={handleZoomIn} title="Zoom In">
          <ZoomInIcon />
        </ToolbarButton>
        <ToolbarButton onClick={handleReset} title="Reset View">
          <ResetIcon />
        </ToolbarButton>
      </div>

      {/* Diagram viewport - transparent top area, content starts below floating controls */}
      <div
        ref={wrapperRef}
        className="mermaid-viewport"
        style={{
          overflow: 'hidden',
          minHeight: '100px',
          maxHeight: '600px',
          padding: '12px',
          paddingTop: '44px',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={diagramRef}
          className="mermaid-diagram"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        />
      </div>
    </div>
  );
}
