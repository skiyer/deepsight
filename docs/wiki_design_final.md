# DeepSight Wiki 自动生成（Claude Code/Agent）最终设计稿

日期：2026-01-27

本设计稿综合吸收 `docs/wiki-auto-generation-claude-draft.md` 及 `docs/wiki-design-review-01.md` / `docs/wiki-design-review-02.md` / `docs/wiki-design-review-03.md` 的共识与互补视角，目标是在 **MVP 可交付** 与 **安全可控** 前提下，产出对安全审计“可用但不完美”的系统分析 Wiki 初稿。

## 1. 背景与目标

DeepSight 已具备 Wiki MVP（固定页面集、工作区落盘、WebView 只读预览、监听变更自动刷新）。本设计稿在此基础上新增：

- 自动生成/更新固定 Wiki 页面 Markdown：为安全渗透/审计人员快速建立“攻击路径心智模型”（架构、数据流、信任边界、攻击面）。
- 生成过程可观察、可取消、可审计；并通过 **仅允许本地 `localhost` Server** 将数据发送边界收敛到本机。

非目标（MVP 不做）：

- WebView 内编辑 Wiki（编辑交给 VS Code 原生编辑器）。
- Server 直接写盘（写盘仅由 Extension 执行）。
- 动态增删页面（继续固定 pages 模式）。
- 自动“事实校验层”（可作为后续迭代）。

安全边界调整（本次变更）：

- **不支持配置远端 `serverUrl`**；Extension 只允许请求 `http://localhost:<port>`（默认 `http://localhost:3000`）。
- 这并不意味着“无网络外发”：本地 Server 仍可能调用模型/SDK 的远端 API；因此仍需最小化读取与敏感路径阻断。

## 2. 设计原则（共识）

- 计算与 IO 分离：Server 负责“只读理解与草稿产出”，Extension 负责“状态/落盘/交互”。
- 文件系统即真相：生成结果写入 `.deepsight/wiki/`，watcher 驱动预览刷新。
- 证据驱动而非完美推理：每页强制输出 Evidence（证据引用），把“核实幻觉”的决策权交给安全专家。
- 安全优先：最小化读取、敏感路径硬阻断；Server 仅允许 `localhost`，并在文档中明确“本机 Server 可能调用远端模型 API”的外发风险。
- KISS：MVP 优先打通主链路（Full Generate + 逐页落盘 + Cancel），避免过度工程。

## 3. 固定页面集（MVP Scope）

固定 6 页（不新增/删除）：

1. `Home.md`
2. `Architecture.md`
3. `Modules.md`
4. `Dataflow.md`
5. `TrustBoundaries.md`
6. `AttackSurface.md`

说明：

- `Home.md` 同时承担 **Manifest（项目地图）** 的角色，类似 `CLAUDE.md`：作为长期稳定的“北斗星”输入源，供后续页面生成复用。
- 若用户未提供 `Home.md`（文件不存在或仅有空模板），MVP 在 Index 阶段基于“极快扫描”自动生成一个初版 `Home.md` 作为 Manifest。
- 一旦 `Home.md` 存在且被用户维护，MVP 默认 **只读取不覆盖**（避免覆盖用户维护的项目地图）。

生成粒度（更新）：

- Full：默认生成/更新 5 页（`Architecture.md`~`AttackSurface.md`），并以 `Home.md` 作为输入 Manifest；若 `Home.md` 缺失则先生成 `Home.md`。
- Current Page：若当前页是 `Home.md`，仅在 `Home.md` 缺失时允许生成；若已存在则默认不覆盖。其余页面可单页生成（M2）。

生成粒度：

- Full：按固定顺序生成 6 页。
- Current Page：仅生成当前打开的 Wiki 页面（M2）。

## 4. 页面模板（强制大纲 + 可选章节）

为保证质量与一致性，Prompt 强制每页包含“必需章节”。当证据不足时，要求明确声明 `confidence: low` 与 `blindSpots`。

### 4.1 通用 Front Matter（Extension 写入/维护）

每页文件头部使用 YAML front matter：

```yaml
---
title: Architecture
created: 2026-01-27T00:00:00Z
updated: 2026-01-27T00:00:00Z
generatedBy: deepsight
generatedAt: 2026-01-27T00:00:00Z
serverUrl: http://localhost:3000
model: <optional>
scope:
  include: ["server", "extension"]
  exclude: ["**/node_modules/**", "**/.git/**"]
confidence: medium
blindSpots: []
---
```

约束：

- `created`：首次生成时写入；后续保持不变。
- `updated` / `generatedAt`：每次生成更新。
- `generatedBy: deepsight`：用于标记来源与审计（MVP 不做冲突保护）。

### 4.2 Home.md（索引与审计目标）

Home 作为“项目地图/Manifest”，建议结构化但保持 Markdown 可读（不要求机器解析）：

必需章节（建议，MVP 不做强校验）：

- `## Summary`（一句话系统定位 + 运行形态）
- `## Tech Stack`（框架/语言/运行时）
- `## Entrypoints`（关键入口文件/启动命令）
- `## Core Modules`（核心模块路径与职责）
- `## Security Focus`（审计关注点：信任边界/关键数据/高风险面）

可选：

- `## Doc Map`（指向 5 个生成页的阅读顺序与用途）
- `## Assumptions`（安全假设）
- `## Known Gaps`（已知盲区/待补齐）

### 4.3 Architecture.md（组件/部署/依赖）

必需章节：

- `## 1. 技术栈与依赖`
- `## 2. 部署/运行形态`
- `## 3. 核心组件与职责`
- `## 4. 数据存储与状态`
- `## Evidence`

### 4.4 Modules.md（逻辑模块拆解）

必需章节：

- `## 1. 模块划分原则`
- `## 2. 模块清单（按重要性排序）`
- `## 3. 模块间依赖关系（可用 mermaid）`
- `## Evidence`

### 4.5 Dataflow.md（数据流与 Sink）

必需章节：

- `## 1. 关键数据对象`
- `## 2. 关键数据流（Source → Transform → Sink）`
- `## 3. 安全相关 Sink（写文件/网络/命令执行/模板渲染等）`
- `## Evidence`

### 4.6 TrustBoundaries.md（信任边界/权限/输入）

必需章节：

- `## 1. 信任边界图（mermaid）`
- `## 2. 用户输入入口与校验`
- `## 3. 权限模型与身份认证`
- `## 4. 外部依赖与信任假设`
- `## Evidence`

### 4.7 AttackSurface.md（攻击面枚举与风险假设）

必需章节：

- `## 1. 可触达入口（API/命令/事件）`
- `## 2. 文件与内容处理面`
- `## 3. 网络通信与外部集成`
- `## 4. 高风险点与优先级建议`
- `## Evidence`

Evidence 章节格式建议（便于人工核对）：

```md
## Evidence

- `server/src/routes/wiki.ts`: `generateWiki()`（SSE 输出协议）
- `extension/src/wiki.ts`: `writeWikiPageAtomically()`（写盘与冲突保护）
```

## 5. 端到端架构（推荐三段式流水线）

1) Extension 发起生成任务

- 收集：workspaceRoot、生成模式（full/current）、scope（include/exclude）、目标 pages。
- Server 固定为 `http://localhost:3000`（或本机端口可配，但 host 必须是 `localhost`）。

2) Server 只读生成

- 新增 `POST /wiki/generate`（SSE）。
- 使用 Agent SDK + 工具白名单 `Read/Glob`。
- 采用 Index-Plan-Execute（索引 -> 计划 -> 执行）生成策略（见第 5.1 节）。

3) Extension 落盘与刷新

- 接收每页草稿后，原子写入 `.deepsight/wiki/<page>.md`。
- 依赖现有 watcher 自动刷新预览。

关键边界：

- Server 不写盘；Extension 不做复杂推理。
- Wiki 仅为“系统理解初稿”，不承诺完美正确。

## 6. 协议设计（SSE + 结构化合约）

综合“可实现性/可解析性/KISS”，采用 **少事件类型 + 强 schema**。在不引入复杂状态机前提下，为 Index-Plan-Execute 增加最小必要事件。

### 6.1 请求

```json
{
  "cwd": "/path/to/workspace",
  "mode": "full",
  "currentPath": "Architecture.md",
  "scope": {
    "include": ["server", "extension"],
    "exclude": ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"]
  },
  "pages": ["Home.md", "Architecture.md", "Modules.md", "Dataflow.md", "TrustBoundaries.md", "AttackSurface.md"]
}
```

### 6.2 SSE 事件

- `progress`：`{ phase, pct, message?, page? }`
- `plan`：`{ pages: { path, outline }[] }`（可选，用于调试/可观测性；生成链路可不依赖此事件）
- `page`：`{ path, title, confidence, markdown }`
- `done`
- `error`：`{ code, message }`

说明：

- `page.markdown` 必须包含完整 Markdown（含正文，不要求包含 front matter）。front matter 由 Extension 统一维护，避免模型输出与本地审计字段不一致。
- 若后续需要更强可观测性，可在 `page` 增加 `stats` 字段（M2/M3）。

### 6.3 Schema（Server/Extension 两侧共用）

```ts
type ProgressEvent = {
  phase: "scanning" | "drafting" | "writing";
  pct: number; // 0-100
  message?: string;
  page?: string; // e.g. "Architecture.md"
};

type PageEvent = {
  path: string; // one of fixed pages
  title: string;
  confidence: "low" | "medium" | "high";
  markdown: string; // MUST include required sections + Evidence
};

type PlanEvent = {
  pages: { path: string; outline: string }[]; // outline 为每页简短大纲（骨架先行）
};

type ErrorEvent = {
  code: string;
  message: string;
};
```

## 7. Prompt 规范（质量约束）

MVP 的质量关键在 Prompt。约束要点：

- 必须按“固定页面模板”输出，包含所有必需章节。
- 严禁大段复制源代码（只摘要 + 引用路径/符号）。
- 每页必须包含 `## Evidence`，列出文件路径与关键符号/片段位置。
- 证据不足时必须：降低 `confidence` 并列出 `blindSpots`（在正文中单独小节也可）。
- 输出仅限 Markdown（不夹杂解释性闲聊文本）。

## 7.1 Index-Plan-Execute 生成策略（匹配上下文窗口）

目标：不要盲读全仓库；先建立“地图”，再按页面目标“挖矿”。

### 阶段 1：构建内部知识清单（Internal Manifest / Index）

- 将 `Home.md` 视为 Manifest（类似 `CLAUDE.md`）：人可读、模型可读、无需结构解析。
- Server 的 Index 阶段默认 **优先 Read `Home.md`** 作为“北斗星”。
- 如果 `Home.md` 不存在或内容明显不足（例如仅空模板），执行极快扫描补齐：目录树/文件名、README、package.json（必要时少量入口文件），并生成一个初版 `Home.md`。
- Manifest 目标：体积小（几百 token 级别），长期驻留上下文，内容覆盖：技术栈、入口文件、核心模块路径、关键审计关注点。

### 阶段 2：骨架先行（Skeleton First / Plan）

- 在生成 6 个页面正文前，先生成一个“全页大纲计划”（JSON 或简短文本）。
- 大纲描述每页要写什么、术语如何统一、各页之间的引用锚点。

### 阶段 3：动态上下文刷新（Execute with Context Refreshing）

针对每个页面（例如 `Dataflow.md`）：

- 压入：`Home.md`(Manifest) + 本页大纲 + 针对性文件内容（Read/Glob 定向读取）。
- 生成：产出该页 Markdown（含 Evidence）。
- 弹出：丢弃本轮读取的长代码片段。
- 保留：仅保留“该页精简摘要”（用于后续页术语一致与交叉引用）。

## 8. 覆盖策略（MVP 简化）

- `Home.md`：作为 Manifest，MVP 仅在文件缺失（或空模板）时写入初版；一旦存在则默认只读不覆盖（由用户维护）。
- 其他页面：MVP 默认直接覆盖写入（不做冲突保护/不做合并），以换取实现简单与生成确定性。

后续可选增强：为非 Home 页面引入冲突保护（generatedBy/contentHash）或“生成到 *.generated.md”。

## 9. 安全与合规（必须项）

- 明确告知：生成会把读取到的代码片段发送至本机 `localhost` Server；该 Server 可能进一步把内容发送到模型/SDK 的远端 API。
- 约束：Extension 端对 `serverUrl` 做硬校验，仅允许 `localhost`（禁止 `127.0.0.1` / 内网 IP / 域名 / HTTPS 远端等，避免绕过与误配）。
- 默认排除：`**/node_modules/**`、`**/.git/**`、`**/dist/**`、`**/build/**`。
- 敏感路径硬阻断（建议默认）：`.env`、`.env.*`、`**/*.pem`、`**/*.key`、`**/credentials*.json`。
- 文件/大小/数量上限：避免过度读取与泄露面扩大；超限触发降级策略（见第 10 节）。
- 审计信息落盘：front matter 记录 `serverUrl(固定 localhost)`、`scope`、`generatedAt`（可选 `model`）。

## 10. 大仓库降级策略（可用框架优先）

当匹配文件数/估算 token 超过阈值：

- 优先生成安全关键页面：`Home.md` → `TrustBoundaries.md` → `AttackSurface.md`。
- 允许 `confidence: low`，并在页面中显式列出 `blindSpots` 与“建议进一步读取的目录/文件”。
- 分阶段扫描（可选 M2）：第一遍只读顶层/文档/配置（README、package.json、服务入口），第二遍再聚焦关键模块（two-pass）。

## 11. 可取消与错误处理

- Cancel：Extension 使用 `AbortController` 终止 SSE；Server 将 abortSignal 传递到 SDK 以停止 agent。
- 原子写：写临时文件后 replace，避免半写入；写盘失败应中断并提示。
- JSON/协议错误：Server 端捕获并发送 `error`；Extension 显示错误并停止写盘。

## 12. 可观测性（MVP 必须做到“可排障”）

- Extension `DeepSight Debug` channel 记录：sessionId、serverUrl(固定 localhost)、scope、阶段切换、每页完成/耗时（如可得）。
- 每页 front matter 记录：generatedAt、confidence、blindSpots（最小质量元数据）。

后续（M3）可扩展：

- `index.json` 增加 generationHistory（session 级别统计）。
- 证据存在性校验（文件是否存在/符号是否可解析），作为“质量防幻觉”演进。

## 13. 配置建议（extension 侧）

建议新增配置节点（默认安全保守）：

- `deepsight.wiki.excludePatterns: string[]`
- `deepsight.wiki.sensitivePaths: string[]`
- `deepsight.wiki.maxFilesRead: number`
- `deepsight.wiki.maxBytesRead: number`
- `deepsight.wiki.maxTokensPerPage: number`
- `deepsight.wiki.strategy: "full" | "two-pass"`

关于 Server 地址：

- 不提供 `deepsight.serverUrl` 的远端自定义能力；Extension 内置 `http://localhost:3000`（可选仅开放 `deepsight.serverPort` 数字配置，但 host 固定 `localhost`）。

## 14. 入口与里程碑

命令面板（优先）：

- `DeepSight: Generate Wiki (Full)`（M1）
- `DeepSight: Cancel Wiki Generation`（M1）
- `DeepSight: Generate Wiki (Current Page)`（M2）

里程碑：

- M1：命令面板 Full 生成 + `POST /wiki/generate` SSE + 原子落盘 + Cancel。
- M2：进度体验增强（withProgress/WebView 可选）+ Current Page 生成 + 简化冲突弹窗。
- M3：可观测性增强（history/metrics）+ 证据校验/质量守护 + two-pass 默认策略优化。
