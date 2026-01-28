# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeepSight is a VS Code extension for AI-powered code explanation and security auditing. Core design philosophy: **Chatless UI** - no chat interface, just CodeLens buttons (✨ Explain / 🛡️ Audit) that trigger analysis displayed in a sidebar.

**Current State:** MVP implementation complete with modern React WebView UI.

## Tech Stack

- **Runtime:** Node.js + tsx (TypeScript)
- **Backend:** Hono (HTTP + SSE streaming) with `@hono/node-server`
- **Core Engine:** `@anthropic-ai/claude-agent-sdk`
- **Frontend:** VS Code Extension (React WebView + CodeLens)
- **WebView UI:** React 18 + Vite + TypeScript
- **Markdown:** react-markdown + remark-gfm + react-syntax-highlighter
- **Environment:** dotenv for configuration

## Project Structure

```
deepsight/
├── server/                      # Node.js + Hono backend
│   ├── src/
│   │   ├── index.ts             # HTTP entry point, loads dotenv
│   │   ├── routes/
│   │   │   └── analyze.ts       # POST /analyze → SSE streaming
│   │   ├── agent.ts             # SDK query() wrapper, WSL path conversion
│   │   └── prompts.ts           # Explain/Audit system prompts (Chinese)
│   ├── .env.example             # Environment variables template
│   ├── package.json
│   └── tsconfig.json
│
├── extension/                   # VS Code extension
│   ├── src/
│   │   ├── extension.ts         # Extension entry, CodeLens, SSE parsing
│   │   ├── codelens.ts          # CodeLens provider (functions/classes)
│   │   └── webview.ts           # State-sync WebView provider
│   ├── webview-ui/              # React WebView UI (Vite)
│   │   ├── src/
│   │   │   ├── main.tsx         # React entry
│   │   │   ├── App.tsx          # Main app with state sync
│   │   │   ├── App.css          # Global styles
│   │   │   └── components/
│   │   │       ├── Header.tsx           # Anchor + mode badge
│   │   │       ├── MarkdownRenderer.tsx # react-markdown rendering
│   │   │       ├── CodeBlock.tsx        # Syntax highlighting
│   │   │       ├── Skeleton.tsx         # Loading skeleton
│   │   │       ├── ToolCall.tsx         # Tool call indicator
│   │   │       ├── Thinking.tsx         # Thinking process panel
│   │   │       └── EmptyState.tsx       # Empty state
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── LICENSE
│   ├── package.json
│   └── tsconfig.json
│
└── CLAUDE.md                    # This file
```

## Build Commands

```bash
# Server
pnpm -C server install
pnpm -C server dev               # Development (tsx watch)
pnpm -C server start             # Start server (tsx)
pnpm -C server build             # Compile TypeScript
pnpm -C server start:prod        # Run compiled code

# Required env vars (see .env.example):
# - ANTHROPIC_AUTH_TOKEN
# - ANTHROPIC_BASE_URL (optional)
# - PORT (optional, default: 3000)

# Extension
pnpm -C extension install
pnpm -C extension/webview-ui install && pnpm -C extension/webview-ui build  # Build React UI first
pnpm -C extension compile        # Build extension
# Press F5 in VS Code to launch Extension Development Host
pnpm -C extension package        # Package as .vsix
```

## Architecture

### State Sync Architecture

The extension uses a **State Sync** pattern where the Extension is the single source of truth:

```
┌─────────────────────┐   state_sync    ┌─────────────────────┐
│     Extension       │ ═══════════════▶│      WebView        │
│ (Single Source of   │  Complete state │  (Pure display)     │
│  Truth)             │  on every update│  No accumulation    │
│                     │                 │  needed             │
│  ViewState {        │                 │                     │
│    status,          │                 │  setState(state)    │
│    content,         │                 │                     │
│    thinking,        │                 │                     │
│    toolCall,        │                 │                     │
│    ...              │                 │                     │
│  }                  │                 │                     │
└─────────────────────┘                 └─────────────────────┘
```

**Benefits:**
- Panel switching doesn't lose data
- Message loss doesn't corrupt state
- WebView rebuild auto-recovers full state

### Communication Flow
1. User clicks CodeLens button (✨ Explain or 🛡️ Audit) above a function/class
2. Extension focuses panel and waits for WebView ready
3. Extension sends POST to `http://localhost:3000/analyze` with file content
4. Server calls Agent SDK `query()`, streams messages via SSE
5. Extension accumulates state and syncs to WebView on each update
6. WebView renders complete state (Markdown + code highlighting)

### SDK Message → Extension State Mapping
| SDK Message Type | Extension Action |
|------------------|------------------|
| `content_block_start` (tool_use) | `setToolCall(name, "running")` |
| `content_block_start` (thinking) | `setThinking("")` |
| `content_block_delta` (text) | `appendContent(text)` |
| `content_block_delta` (partial_json) | Log tool input |
| `content_block_delta` (thinking) | `appendThinking(text)` |
| `content_block_stop` | `clearToolCall()` |
| `tool_result` | `clearToolCall()` |
| Done | `setComplete()` |

**Note:** `assistant` messages are skipped to avoid duplicate content.

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/analyze` | Start streaming analysis (SSE) |

### ViewState Interface

```typescript
interface ViewState {
  status: "empty" | "loading" | "streaming" | "done" | "error";
  anchor: string;           // e.g., "app.ts:processData"
  mode: "explain" | "audit";
  content: string;          // Accumulated markdown content
  thinking: string;         // Accumulated thinking process
  toolCall: {
    name: string;           // e.g., "Read", "Glob"
    status: "running" | "done";
    info?: string;          // e.g., "📄 utils.ts"
  } | null;
  error: string;
}
```

## Key Design Decisions

1. **Chatless UI:** Actions via CodeLens buttons, no chat input
2. **State Sync Pattern:** Extension is single source of truth, WebView is pure display
3. **Streaming First:** SSE for real-time content updates
4. **Modern WebView:** React 18 + Vite with syntax highlighting
5. **Limited Tools:** `allowedTools: ["Read", "Glob"]` for security
6. **Single File Scope:** MVP analyzes only the current file
7. **WSL Support:** Automatic Windows-to-WSL path conversion
8. **Tool Visibility:** Tool calls and thinking process shown in UI

## Configuration

Server reads environment variables from `.env` file:

```bash
# server/.env
ANTHROPIC_AUTH_TOKEN=your_token
ANTHROPIC_BASE_URL=https://api.anthropic.com  # optional
PORT=3000                                     # optional
```

## Debugging

- Server: Check console output for `[analyze]` and `[SDK stderr]` logs
- Extension: Use `DeepSight Debug` output channel
  - `[TOOL START]` / `[TOOL STOP]` - Tool call lifecycle
  - `[THINKING]` - Thinking process content
  - `[TEXT]` - Content being added
  - `[MSG #N]` - All SSE messages
- WebView: Receives complete `state_sync` messages

## WebView UI Components

| Component | Purpose |
|-----------|---------|
| `Header` | Shows anchor (file:function) and mode badge |
| `MarkdownRenderer` | Renders markdown with GFM support |
| `CodeBlock` | Syntax highlighting with copy button |
| `Skeleton` | Loading animation (shimmer effect) |
| `ToolCall` | Shows active tool (📖 Read, 🔍 Glob, etc.) |
| `Thinking` | Collapsible thinking process panel |
| `EmptyState` | Initial state prompt |

## Reference Documentation

- `Architect.md` - Full technical architecture (Chinese)
- `UI.md` - UI/UX design specification (Chinese)
- `Agent_SDK_ref.md` - Claude Agent SDK API reference
