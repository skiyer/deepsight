# DeepSight Server

AI-powered code explanation and security auditing server for VS Code extension.

## Quick Start

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your ANTHROPIC_AUTH_TOKEN
```

3. Run development server:
```bash
pnpm dev
```

4. Run production server:
```bash
pnpm start
```

## Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Compile TypeScript to JavaScript
- `pnpm start` - Run compiled server
- `pnpm start:prod` - Run production server

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_AUTH_TOKEN` | Required. Your Anthropic API authentication token | - |
| `ANTHROPIC_BASE_URL` | Optional. Anthropic API base URL | `https://api.anthropic.com` |
| `DEEPSIGHT_PORT` | Optional. Server port (use `DEEPSIGHT_PORT` in Docker to avoid conflict with code-server) | `3000` |

## API Endpoints

### POST /analyze

Analyzes code and returns Server-Sent Events stream.

**Request Body:**
```json
{
  "file": "/path/to/file.c",
  "line": 42,
  "lineText": "void foo() { ... }",
  "mode": "explain" | "audit",
  "cwd": "/working/directory"
}
```

**Response:** Server-Sent Events stream with message types:
- `chunk` - Streaming deltas (`stream_event` payloads)
- `done` - Analysis completed (`result` payload)
- `error` - Error occurred

## Architecture

The server uses:
- **Hono** - Web framework for HTTP server and routing
- **Claude Agent SDK** - AI agent capabilities with tool use
- **Server-Sent Events** - Real-time streaming to VS Code extension
- **Limited Toolset** - Only `Read` and `Glob` tools for security

## Security Notes

- Tools are limited to `Read` and `Glob` only
- Permission mode is set to `bypassPermissions`
