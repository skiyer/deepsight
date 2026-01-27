# DeepSight Wiki 自动生成 - 构建计划（Implementation TODO）

基于 `docs/wiki_design_final.md`（localhost-only 约束版），将设计落地为可交付的 MVP（M1），并为 M2/M3 预留自然演进路径。

## 0. 约束确认（P0）

- Extension 仅允许请求本机 Server：`http://localhost:<port>`；默认 `http://localhost:3000`。
- 禁止远端 `serverUrl` 配置（不允许域名/IP/127.0.0.1/https）。

验收：任意非 `localhost` 配置均被拒绝并给出明确错误提示。

## 1. Extension：配置与校验（P0）

- 更新 `extension/package.json` 配置：
  - 移除/废弃 `deepsight.serverUrl`（或保留但标记 deprecated 且强校验 localhost）。
  - 新增 `deepsight.serverPort`（number，默认 3000）。
- 在 Extension 侧实现 server 地址生成与硬校验：
  - `serverUrl = http://localhost:${serverPort}`
  - 校验 port 范围（1-65535）
- 所有对 server 的 fetch 均使用该 `serverUrl`。

验收：

- 修改设置后，分析与 Wiki 生成均走 `localhost`。
- 非法端口会被拦截并提示。

## 2. Server：新增 Wiki 生成 SSE 路由（P0）

- 新增路由：`POST /wiki/generate`（SSE）。
- 请求体：`{ cwd, mode, currentPath?, scope, pages }`。
- SSE 事件：`progress` / `page` / `done` / `error`。
- 内部执行采用 Index-Plan-Execute（见第 2.1-2.3），但 Extension 的写盘链路只依赖 `page` 事件即可。
- 只读工具白名单：`Read/Glob`（沿用现有 agent 配置）。

验收：

- curl/Extension 可建立 SSE 连接。
- 至少能返回 1 个 `page` 事件与 `done`。

### 2.1 Server：阶段 1 - Manifest First（Index）

- 将 `Home.md` 视为 Manifest（类似 `CLAUDE.md`）。
- Index 阶段顺序：
  1) 优先 Read `Home.md`
  2) 若 `Home.md` 不存在或信息不足，再做极快扫描（控制 token）：
     - 目录树/文件名（Glob 列举，避免 Read 大文件）
     - `README*`、`package.json`（必要时再读少量入口文件）
  3) 若 `Home.md` 缺失：基于扫描结果生成初版 `Home.md`（作为 Manifest）并落盘
- 不输出/不落盘单独的 manifest 文件；也不要求格式解析。

验收：

- 仅压入 `Home.md` 也能稳定指导后续生成。
- `Home.md` 缺失时能自动生成初版，再继续 plan/execute。

### 2.2 Server：阶段 2 - Skeleton First（Plan）

- 基于 manifest 生成 6 页“骨架大纲”计划（JSON 或简短文本）。
- 明确术语与页面锚点，避免后续生成术语漂移。
-（可选）通过 SSE 发 `plan` 事件用于调试。

验收：每页 outline 简短且覆盖模板必需章节。

### 2.3 Server：阶段 3 - Execute with Context Refreshing

- 逐页生成：每页请求上下文 = `Home.md`(Manifest) + 本页 outline + 定向 Read/Glob 的证据文件。
- 每页生成结束后，只保留“该页精简摘要”（给下一页用）；丢弃长代码片段。

验收：多页生成过程中 token 使用稳定，无需盲读全仓库。

## 3. Server：WIKI_PROMPT 与模板约束（P0）

- 在 `server/src/prompts.ts` 增加 `WIKI_PROMPT`：
  - 固定 6 页模板（强制章节 + `## Evidence`）。
  - 禁止大段复制代码（只摘要 + 路径/符号引用）。
  - 证据不足降级：`confidence: low` + 输出 blindSpots。
- 让 server 按 page 逐页生成（Full：固定顺序；Current：单页），并按“manifest/plan -> page”流水线执行。

验收：

- 生成的 Markdown 每页都包含 `## Evidence`。
- 页面章节齐全；缺失时会显式降级。

## 4. Extension：Wiki Generate/Cancel 命令（M1, P0/P1）

- 新增命令（并在 `extension/package.json` contributes.commands 注册）：
  - `DeepSight: Generate Wiki (Full)`
  - `DeepSight: Cancel Wiki Generation`
  - （M2）`DeepSight: Generate Wiki (Current Page)`
- 在 Extension 侧维护一次生成会话：
  - 用 `AbortController` 控制 SSE 请求。
  - Cancel 立即 abort，并清理状态。

验收：

- Full 生成过程中可 Cancel，3 秒内停止写盘与 UI 更新。

说明（更新）：

- Full 默认生成/更新 5 页（不覆盖已存在的 `Home.md`）；若检测到 `Home.md` 缺失，则先生成 `Home.md` 再继续。
- Current Page 若为 `Home.md`：
  - 若缺失：允许生成
  - 若存在：提示“Home 作为 Manifest 默认不覆盖”（MVP）

## 5. Extension：SSE 解析与逐页原子落盘（M1, P0）

- 复用/封装 SSE 解析逻辑（与 analyze 类似，但事件不同）。
- 接收到 `page`：
  - 目标写入 `.deepsight/wiki/<path>`。
  - 原子写：临时文件 + replace。
  - front matter 由 Extension 写入/维护（created/updated/generatedBy/generatedAt/confidence/scope/serverUrl）。

验收：

- 写盘后 WebView Wiki 预览自动刷新（watcher 生效）。
- 生成过程中按页逐步可见。

## 6. Extension：覆盖策略（MVP 简化）

- `Home.md`：视为 Manifest，仅在缺失时写入初版；存在则不覆盖。
- 其他页面：MVP 直接覆盖写入（不做冲突保护/不做合并）。

验收：生成结果确定、实现简单；用户若需要保留手工内容，手动保存到其他文件。

## 7. 安全：敏感路径与最小化读取（M1, P0）

- Extension 侧提供 `deepsight.wiki.excludePatterns` 与 `deepsight.wiki.sensitivePaths` 默认值。
- Server 侧在 Read/Glob 前做二次过滤：
  - 命中敏感路径则拒绝读取。
  - 超过 maxFiles/maxBytes 时触发降级。

验收：

- `.env`/`*.key` 等文件无法被生成流程读取（即便被 prompt 间接诱导）。

## 8. 降级策略（M1, P1）

- 当超限（文件数/字节/token 估算）时：
  - 只生成 `Home.md` → `TrustBoundaries.md` → `AttackSurface.md`。
  - 其余页面输出 low confidence + blindSpots（或跳过并在 Home 标注）。

验收：

- 大仓库不会全失败；至少产出关键 3 页。

## 9. 可观测性（M1, P1）

- Extension `DeepSight Debug` channel 输出：
  - sessionId、serverUrl(固定 localhost)、scope、阶段、每页完成。
- 每页 front matter 最小指标：confidence、blindSpots、generatedAt。

（可选）补充日志：manifest 规模（文件数/入口文件）、plan 生成成功与否。

验收：

- 出错时能从日志定位阶段与页面。

## 10. UI（可选，M2）

- WebView Wiki 页加入“生成中”状态展示（或直接复用 VS Code `withProgress`）。
- 支持 Current Page 生成：以当前 `wiki.currentPath` 为目标。

验收：

- 用户可在 Wiki 视图内看到生成进度与当前页。

## 11. 测试（M1, P1）

- 基本单测：
  - localhost-only 校验
  - front matter 读写
-  - 覆盖策略（Home 缺失则生成；存在不覆盖；其它页覆盖）
- 集成测试（最小）：
  - 启动 server，Extension 发起 Full Generate，断言 `.deepsight/wiki/*.md` 更新。

验收：CI/本地能稳定复现。

## 12. 交付检查清单（M1）

- 命令：Full Generate / Cancel 可用。
- Server：`POST /wiki/generate` SSE 可用。
- Wiki：6 页可逐页生成并落盘；`Home.md` 不被自动覆盖；其余页面可覆盖更新。
- 安全：仅 localhost；敏感路径阻断；默认排除生效。
