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
| `PORT` | Optional. Server port | `3000` |
| `DEBUG_PROMPT` | Optional. Enable detailed prompt logging. See Debug section. | `false` |

## Debug

### Viewing Complete Prompt Input

Enable `DEBUG_PROMPT=true` in your `.env` file to see the complete system and user prompts sent to Claude:

```bash
DEBUG_PROMPT=true
```

When enabled, the server console will display:

```
================================================================================
[PROMPT DEBUG] System Prompt:
================================================================================
[完整的系统提示词内容]
================================================================================

================================================================================
[PROMPT DEBUG] User Prompt:
================================================================================
请分析以下代码（文件：test.c，焦点行：42）：

```c
void processData(int* data, size_t len) {
    for (size_t i = 0; i < len; i++) {
        data[i] = data[i] * 2;
    }
}
```

请解释这段代码的功能和数据流。
================================================================================

[PROMPT DEBUG] Stats: System=892 chars, User=234 chars, Total=1126 chars
================================================================================
```

### Other Debug Output

The server provides several debug log categories:

- `[analyze]` - Analysis start and configuration information
- `[SDK stderr]` - SDK standard error output
- `[SSE]` - Server-Sent Events messages
- `[PROMPT DEBUG]` - Complete prompt content (when DEBUG_PROMPT=true)

### Disabling Debug Output

Set `DEBUG_PROMPT=false` or remove the line from `.env` to disable prompt logging.

## API Endpoints

### POST /analyze

Analyzes code and returns Server-Sent Events stream.

**Request Body:**
```json
{
  "file": "/path/to/file.c",
  "code": "void foo() { ... }",
  "line": 42,
  "mode": "explain" | "audit",
  "cwd": "/working/directory"
}
```

**Response:** Server-Sent Events stream with message types:
- `stream_event` - Partial content updates
- `message` - Complete assistant messages
- `tool_result` - Tool execution results
- `done` - Analysis completed
- `error` - Error occurred

### GET /health

Health check endpoint.

**Response:** `200 OK` with text "OK"

## Architecture

The server uses:
- **Hono** - Web framework for HTTP server and routing
- **Claude Agent SDK** - AI agent capabilities with tool use
- **Server-Sent Events** - Real-time streaming to VS Code extension
- **Limited Toolset** - Only `Read` and `Glob` tools for security

## Security Notes

- Tools are limited to `Read` and `Glob` only
- Permission mode is set to `bypassPermissions`
- WSL path conversion supported for Windows Subsystem for Linux
