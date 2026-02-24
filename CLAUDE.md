# CLAUDE.md

Guidance for working with the DeepSight codebase.

## Overview

DeepSight is a VS Code extension for AI-powered code explanation and security auditing. Features a **Chatless UI** - actions via CodeLens buttons (✨ Explain / 🛡️ Audit) with results in a sidebar panel. Includes a **Wiki system** for generating security documentation.

## Project Structure

```
deepsight/
├── extension/          # VS Code Extension
│   ├── src/
│   │   ├── extension.ts     # Entry point, commands, SSE handling
│   │   ├── codelens.ts      # CodeLens provider for symbols
│   │   ├── webview.ts       # State-sync WebView provider
│   │   └── utils/           # Config, symbols, frontmatter helpers
│   ├── webview-ui/          # React 18 + Vite WebView UI
│   │   └── src/
│   │       ├── App.tsx           # Main app with blocks rendering
│   │       └── components/       # Markdown, ToolCall, Thinking, etc.
│   └── package.json
│
├── server/             # Node.js + Hono backend
│   ├── src/
│   │   ├── index.ts         # HTTP entry point
│   │   ├── app.ts           # Hono app with routes
│   │   ├── agent.ts         # Claude Agent SDK wrapper
│   │   ├── wiki.ts          # Wiki generation engine
│   │   └── routes/
│   │       ├── analyze.ts   # POST /analyze → SSE
│   │       └── wiki.ts      # POST /wiki/generate → SSE
│   └── package.json
│
└── cli/                # CLI tool for document scanning
    └── src/
        ├── index.ts
        └── run.ts
```

## Quick Start

```bash
# Install all dependencies
pnpm -C extension install
pnpm -C server install
pnpm -C cli install

# Build and run server
pnpm -C server dev          # Development (tsx watch)
pnpm -C server start        # Production start

# Build extension
pnpm -C extension/webview-ui install
pnpm -C extension/webview-ui build
pnpm -C extension compile

# Run tests
pnpm -C extension test
pnpm -C server test
pnpm -C cli test
```

**Required env vars** (server/.env):
- `ANTHROPIC_AUTH_TOKEN` - Claude API token
- `DEEPSIGHT_PORT` - Server port (default: 3000)

## Architecture

### State Sync Pattern
Extension maintains complete state; WebView is pure display:

```
┌─────────────┐   state_sync    ┌─────────────┐
│  Extension  │ ═══════════════▶│   WebView   │
│(Single     │  Complete state │ (Display    │
│ Source)     │  on every update│  only)      │
└─────────────┘                 └─────────────┘
```

**Benefits:** Panel switching doesn't lose data; message loss doesn't corrupt state.

### Content Blocks
Analysis content is rendered as sequential blocks:

| Block Type | Purpose |
|------------|---------|
| `text` | Main markdown content |
| `tool` | Tool call indicator (Read, Glob) |
| `thinking` | AI thinking process |

Blocks are created via `viewProvider.startBlock(type)` and appended via `appendToCurrentTextBlock()`.

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/analyze` | Analyze code at line (SSE stream) |
| POST | `/wiki/generate` | Generate security wiki (SSE stream) |

## Key Features

### 1. Code Analysis (Explain/Audit)
- CodeLens buttons appear above functions/classes
- Supports: C, C++, TypeScript, JavaScript, Python, Go, Rust, Java
- Results stream in real-time via SSE

### 2. Wiki System
Security documentation generator with pre-defined page types:
- **Home** - Overview and navigation
- **Architecture** - System components and boundaries
- **Modules** - Module inventory and dependencies
- **Dataflow** - Input-to-sink data paths
- **Trust Boundaries** - Security boundaries and validation
- **Attack Surface** - Exposed interfaces and risks

Wiki files stored in `.deepsight/wiki/` with YAML frontmatter.

### 3. CLI Tool
Document scanning and report generation:
- Scans workspace for documents (.md, .docx, .pptx, .txt)
- Converts binary docs using markitdown
- Generates structured reports

## Configuration

VS Code settings (`deepsight.*`):

| Setting | Default | Description |
|---------|---------|-------------|
| `serverPort` | 3000 | Backend server port |
| `wiki.excludePatterns` | `["**/node_modules/**", ...]` | Exclude from wiki scan |
| `wiki.sensitivePaths` | `[".env", "*.pem", ...]` | Blocked sensitive paths |
| `wiki.maxFilesRead` | 400 | Max files for wiki generation |
| `wiki.maxBytesRead` | 2MB | Max bytes for wiki generation |

## Commands

| Command | Key | Description |
|---------|-----|-------------|
| `deepsight.explainAtLine` | - | Explain code at cursor |
| `deepsight.auditAtLine` | - | Security audit at cursor |
| `deepsight.openWiki` | - | Open Wiki panel |
| `deepsight.generateWiki` | - | Generate security wiki |
| `deepsight.cancelWiki` | - | Cancel wiki generation |

## Debugging

**Extension:** Output channel "DeepSight Debug"
- `[TOOL START/STOP]` - Tool lifecycle
- `[THINKING]` - Thinking content
- `[TEXT]` - Content chunks

**Server:** Console logs with `[analyze]` prefix

## File Locations

- Extension entry: `extension/src/extension.ts`
- WebView UI: `extension/webview-ui/src/App.tsx`
- Server routes: `server/src/routes/`
- Wiki engine: `server/src/wiki.ts`
- Agent wrapper: `server/src/agent.ts`

## References

- `Architect.md` - Full technical architecture (Chinese)
- `UI.md` - UI/UX design spec (Chinese)
- `Agent_SDK_ref.md` - Claude Agent SDK API reference
