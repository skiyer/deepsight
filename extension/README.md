# DeepSight Extension（MVP：System Analysis Wiki）

本 README 描述当前 VS Code 插件侧的 Wiki MVP 方案设计稿：面向安全审计/渗透专家，用于在超大规模代码仓库（Chromium、Linux Kernel 等）中沉淀“系统级分析 Wiki”。

## 目标用户与目标

**目标用户**：安全渗透/安全审计专家。

**目标**：在 VS Code 内快速浏览/维护（通过文件落盘）系统分析知识库，覆盖：
- 系统架构分析（组件/子系统、关键依赖、边界）
- 模块功能分析（职责、入口、关键 API、风险点）
- 数据流（敏感数据、关键路径、跨边界跳点）
- 信任边界（边界类型、穿越点、校验逻辑）
- 攻击面（外部入口、可控输入、测试清单）

## MVP 范围（已实现）

### 1) 固定页面模式（无需新建/删除/关闭）
MVP 以“固定页面集”承载系统分析：
- 主页（Home）
- 系统架构（Architecture）
- 模块（Modules）
- 数据流（Dataflow）
- 信任边界（Trust Boundaries）
- 攻击面（Attack Surface）

页面清单由 `.deepsight/wiki/index.json` 定义（顺序与标题可调整）。

### 2) Wiki 落盘存储（Workspace 内文件）
Wiki 存储在当前工作区根目录下：
- `.deepsight/wiki/index.json`：页面索引
- `.deepsight/wiki/*.md`：各页面 Markdown

首次进入 Wiki 时，如果上述文件不存在，会自动初始化生成默认 index 与默认页面模板。

### 3) Webview 只读预览（编辑在 VS Code 中完成）
Wiki 在 Webview 内为**只读预览**：
- 左侧：固定页面列表（支持拖动调整宽度）
- 右侧：Markdown 预览（包含 metadata 展示）
- 顶部：Analysis/Wiki 模式切换

编辑方式：直接在 VS Code 资源管理器打开 `.deepsight/wiki/*.md` 编辑并保存。

### 4) 自动更新（保存即刷新）
Extension 端监听 `.deepsight/wiki/**` 的文件变化（create/change/delete），在你保存 Wiki 文件后：
- 自动刷新页面列表
- 自动重新加载当前页内容

Webview 侧保留 `Refresh` 按钮作为兜底。

### 5) Front Matter（metadata）展示与渲染
每个页面可在 Markdown 顶部使用 YAML front matter 记录 metadata，例如：

```yaml
---
title: 系统架构
type: architecture
updated: 2026-01-26T10:00:00.000Z
---
```

MVP 行为：
- 预览时会从正文中剥离 front matter（避免被当作 Markdown 分隔线导致显示异常）
- 同时在正文上方以“Metadata 面板”展示解析出的 key/value
- `updated/created` 字段会尝试格式化为本地可读时间

## 用户使用流程（MVP）

1. 打开 Activity Bar 的 `DeepSight`。
2. 运行命令面板：`DeepSight: Open Wiki` 进入 Wiki。
3. 在 Wiki 中选择页面查看内容。
4. 在 VS Code 资源管理器中打开 `.deepsight/wiki/*.md` 编辑并保存。
5. 保存后 Webview 将自动刷新预览内容。

## 命令与入口

- `deepsight.explain`：解释代码（CodeLens 触发）
- `deepsight.audit`：安全审计（CodeLens 触发）
- `deepsight.openWiki`：打开 Wiki 模式

## 架构与数据流（Extension/Webview）

- Extension 侧维护单一事实源状态（`state_sync` 全量下发给 Webview）。
- Webview 侧纯渲染，不落盘；Wiki 文件读写/监听均在 Extension 侧完成。

## 限制（MVP 明确不做）

- Webview 内编辑（避免与 VS Code 原生编辑器重复）
- Pages 搜索/过滤（固定页模式下先不做）
- Mermaid/Graphviz 运行时渲染（当前仅以代码块承载图源码）
- 图片/附件渲染（受 CSP 限制，后续需要设计本地资源加载策略）

## 开发与构建

- Webview UI：`pnpm -C extension/webview-ui build`
- Extension：`pnpm -C extension compile`

后续如需打包 VSIX：使用 `extension/package.json` 中的 `package` 脚本。
