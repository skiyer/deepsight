# DeepSight Wiki 自动生成（Claude Code/Agent）设计草案

日期：2026-01-26

## 1. 背景与目标

DeepSight 已具备落盘 Wiki MVP：
- 固定页面集（不新建、不删除）
- Webview 只读预览（编辑交给 VS Code 原生编辑器）
- 工作区落盘：`.deepsight/wiki/*.md` + `index.json`
- 监听文件变更自动刷新预览

本草案新增目标：
- 利用 Claude Code/Agent 能力对仓库进行结构化理解，并**自动生成/更新**上述固定 Wiki 页面的 Markdown 文件。
- 让安全渗透专家能快速获得：系统架构、模块功能、关键数据流、信任边界、攻击面与风险假设。

非目标（MVP 不做）：
- 不在 Webview 内编辑 Wiki
- 不允许模型直接写文件（避免远端 serverUrl 场景下的写盘/权限风险）
- 不支持动态增删页面（继续固定 pages 模式）

## 2. 用户画像与价值

用户：安全渗透专家 / 红队 / 安全审计工程师
- 典型场景：面对超大规模代码库（Chromium、Linux kernel、大型微服务）需要快速建立可操作的“攻击路径心智模型”。
- 期望：
  - 先有“可用但不完美”的系统理解框架
  - 再逐步用证据与代码定位去补齐与修正

## 3. 功能范围（MVP）

### 3.1 入口（建议）
- 命令面板：
  - `DeepSight: Generate Wiki (Full)`
  - `DeepSight: Generate Wiki (Current Page)`
  - `DeepSight: Cancel Wiki Generation`
- Webview Wiki 侧（可选后续迭代）：
  - `Generate` 按钮 + 进度展示

### 3.2 生成粒度
- 全量生成：按固定顺序生成 6 个页面
- 当前页生成：仅生成正在打开的 wiki 页面

### 3.3 写盘策略
- 生成结果由 Extension 落盘到：`.deepsight/wiki/<page>.md`
- 原子写：写临时文件后 replace，避免半写入/抖动
- front matter 维护：
  - `created`：首次生成
  - `updated`：每次生成
  - `generatedBy: deepsight`
  - 可选：`model`、`serverUrl`、`scope`、`confidence`

## 4. 核心架构方案（推荐：三段式流水线）

结合当前代码结构：
- server 已使用 `@anthropic-ai/claude-agent-sdk` 的 `query()`
- agent 工具限制为 `Read/Glob`
- extension 已具备 wiki 落盘与 watcher 自动刷新

推荐流水线：

1) **Extension 发起生成任务**
- 收集 workspaceRoot、范围（全仓库/子目录）、排除规则、生成模式（Full/Current）
- 调用 server 新增 SSE 路由：`POST /wiki/generate`

2) **Server 负责“读仓库 + 产出结构化页面草稿”**（只读工具）
- 给 agent 一个专用 system prompt（例如 `WIKI_PROMPT`）
- 要求输出**严格 JSON 合约**（每页一个对象），并通过 SSE 逐页发送

3) **Extension 负责“落盘 + 刷新预览”**
- 接收每个 `page_draft` 事件后立刻写入 `.deepsight/wiki/<path>`
- 写完后依赖现有 watcher 自动刷新；必要时可主动 `wiki_list` + `wiki_open`

说明：
- 不让 server 直接写文件，是为了适配 `serverUrl` 可配置且可能远端的现实；写盘必须在本地 VS Code Extension 侧完成。

## 5. 事件与数据合约（SSE）

### 5.1 请求参数（示例）
```json
{
  "cwd": "/path/to/workspace",
  "mode": "full",
  "currentPath": "Architecture.md",
  "scope": {
    "include": ["src", "server"],
    "exclude": ["**/node_modules/**", "**/.git/**", "**/dist/**"]
  },
  "pages": ["Home.md", "Architecture.md", "Modules.md", "Dataflow.md", "TrustBoundaries.md", "AttackSurface.md"]
}
```

### 5.2 SSE 事件（建议）
- `event: progress`
  - `{ phase: "scanning"|"drafting"|"writing", pct: number, message?: string }`
- `event: page_draft`
  - 见下一节 JSON 合约
- `event: done`
- `event: error`

### 5.3 page_draft JSON 合约（强制）
```json
{
  "type": "wiki_page",
  "path": "Architecture.md",
  "title": "Architecture",
  "frontMatter": {
    "title": "Architecture",
    "created": "2026-01-26T00:00:00Z",
    "updated": "2026-01-26T00:00:00Z",
    "generatedBy": "deepsight",
    "confidence": "medium"
  },
  "markdown": "# Architecture\n...\n"
}
```

## 6. Prompt 规范（质量与可实现性关键）

建议写入 system prompt 的硬约束：
- 必须输出合法 JSON（每次一个 `wiki_page` 对象）
- 不要输出 markdown 外的多余文本
- 避免大段复制源代码（只摘要 + 引用位置）
- 每页必须包含“证据列表”小节：
  - 引用文件路径与符号名（先纯文本即可，后续可做跳转）
- 在超大仓库时允许 `confidence: low` 并列出“需要进一步读取的目录/文件”

## 7. 安全与信任边界（必须明确）

风险点：`deepsight.serverUrl` 可配置且可能为远端。生成 Wiki 意味着会把仓库内容（被 Read/Glob 读取到的片段）发送到 server，并进一步送往模型/SDK。

建议：
- 首次生成前弹窗确认：将代码发送到 `<serverUrl>` 是否继续
- 默认排除目录：`node_modules/.git/dist/build` 等
- 文件大小与数量上限（避免过度读取/泄露）
- front matter 可记录审计信息：`serverUrl`、`model`、`generatedAt`、`scope`

## 8. User Story（详细设计稿）

### Epic：自动化生成系统分析 Wiki（Claude Code/Agent 驱动）

#### US-01 全量生成固定 Wiki
- 作为：安全渗透专家
- 我希望：一键生成整个系统分析 Wiki
- 以便：快速建立对系统架构、信任边界与攻击面的心智模型
- 主流程：
  1. 运行命令 `Generate Wiki (Full)`
  2. 选择范围（workspace root / 子目录）与排除规则（默认值可用）
  3. 首次生成提示 serverUrl 风险并确认
  4. 生成开始：显示进度（Scanning → Drafting → Writing）
  5. 逐页落盘并自动刷新预览
- 验收标准：
  - `.deepsight/wiki/` 下 6 个固定页面生成/更新完成
  - 生成过程中至少按页逐步可用（写盘即预览可刷新）
  - 失败不留下半写入垃圾内容（原子写生效）

#### US-02 只生成当前页
- 作为：用户
- 我希望：只更新当前查看的 Wiki 页面
- 以便：对某个主题快速迭代（如 Trust Boundaries）
- 验收标准：
  - 仅覆盖一个 `.md` 文件
  - 其他页面不被改动

#### US-03 生成前冲突检查（保护人工编辑）
- 作为：用户
- 我希望：当页面被我手工改过时，生成不会无提示覆盖
- 以便：避免丢失人工结论与证据
- 设计建议：
  - front matter 中记录 `generatedBy` 与 `generatedAt`
  - 覆盖前如果检测到“明显人工修改”（例如 hash 不一致/缺少 generatedBy）：弹窗三选一
    - 覆盖
    - 生成到 `<page>.generated.md`
    - 取消
- 验收标准：
  - 手工改动页面不会被静默覆盖

#### US-04 可取消
- 作为：用户
- 我希望：生成过程中能随时取消
- 以便：范围选错或避免卡住
- 验收标准：
  - 取消后停止 SSE 与写盘
  - UI 状态恢复 idle，并提示已取消

#### US-05 范围可控与默认排除
- 作为：安全渗透专家
- 我希望：限制生成只扫描某些目录并默认排除常见噪音目录
- 以便：减少泄露面与提升结论质量
- 验收标准：
  - 证据列表不引用被排除路径

#### US-06 大仓库降级策略
- 作为：用户
- 我希望：超大仓库也能先产出“可用框架”而不是直接失败
- 以便：先看全局，再补齐细节
- 设计建议：
  - 分阶段优先安全视角页面：Home/Trust Boundaries/Attack Surface
  - 允许 `confidence: low` 并输出待进一步读取清单
- 验收标准：
  - 至少产出关键页面，不因上限直接全失败

#### US-07 过程可观察与可审计
- 作为：用户/Reviewer
- 我希望：能看到生成过程、来源范围与模型信息
- 以便：判断可靠性与复核
- 验收标准：
  - UI/输出日志可见当前阶段与页名
  - front matter 记录必要审计字段（至少 updated/generatedBy/scope）

## 9. 里程碑建议

- M1：命令面板全量生成 + server `/wiki/generate` SSE + Extension 落盘
- M2：Webview 加 Generate/Cancel + 进度展示
- M3：冲突保护（人工编辑检测）、范围选择 UI、失败重试

## 10. 与现有实现的对齐点（备忘）

- 既有 watcher 能自动刷新 `.deepsight/wiki/**`，生成写盘即可触发预览刷新。
- Server 端 agent 已限制工具 `Read/Glob`，适合“理解与总结”，不直接写文件。
- Extension 侧应承担所有写盘，以适配远端 serverUrl 与最小化安全风险。
