# DeepSight Extension – Wiki MVP 工作进展（基于当前代码）

> 日期：2026-01-26

本文件记录 Wiki MVP 的已完成事项、当前行为与下一步工作项，便于继续迭代“超大规模代码项目系统分析 Wiki”。

## 已完成（Done）

- Wiki/Analysis 双模式：在同一个 Webview View 中通过 `page: 'analysis' | 'wiki'` 切换，Extension 统一以 `state_sync` 下发全量状态。
- Wiki 落盘初始化：首次进入 Wiki 自动创建 `.deepsight/wiki/`、`.deepsight/wiki/index.json` 和 6 个默认页面模板（主页/系统架构/模块/数据流/信任边界/攻击面）。
- 固定 Pages 模式：不提供新建/删除/关闭页面能力；页面列表来源于 `index.json`（可手工改索引实现调整顺序/标题）。
- Webview 只读预览：Wiki 在 Webview 内仅展示预览（无编辑器、无保存/dirty 状态 UI）。
- Metadata 显示修复：预览时剥离 YAML front matter；并在正文上方显示 metadata 面板；对 `updated/created` 做本地时间格式化。
- 自动更新：Extension 使用 `createFileSystemWatcher` 监听 `.deepsight/wiki/**`，保存/变更后自动刷新 pages 与当前页内容（带 200ms debounce）。
- UI 细节：Wiki 左侧页面栏支持拖动调节宽度，并存储在 `localStorage`。
- 命令入口：新增 `DeepSight: Open Wiki`（`deepsight.openWiki`）。
- Mermaid 支持：Webview 可渲染 `mermaid` fenced code block（输出为 SVG 图）。

## 当前行为（What it does now）

- 进入 Wiki 会确保 `.deepsight/wiki` 与 index/pages 存在，然后加载 `index.json`，默认打开列表中的第一页。
- 你在 VS Code 编辑器中保存 `.deepsight/wiki/*.md` 后，Webview 将自动刷新预览（无需手动点 Refresh）。
- Webview 仍保留 `Refresh` 按钮作为手动兜底。

## 待办（Next）

### 高优先级

- 证据链接/跳转：支持从 Wiki 正文点击“代码证据”跳转到文件/符号/行号（建议走 Webview->Extension 消息，再由 Extension 调 VS Code API 打开定位）。
- 图片/附件策略：允许本地 `assets/` 引用并通过 `asWebviewUri` 安全展示，同时扩展 CSP 的 `img-src`。

### 中优先级

- Wiki 元数据规范化：定义安全分析字段（scope/target/version/confidence/sources/assumptions），并在 UI 上提供更友好的展示（分组/标签/时间线）。
- Multi-root 支持增强：当前使用 active editor 所属 workspaceFolder（无则取第一个）；后续可允许用户选择“当前 Wiki 属于哪个根”。
- 性能：对超大仓库避免频繁全量 refresh（增量加载 index + 当前页，或缓存）。

### 低优先级

- 导出：把 Wiki 导出为单一报告（HTML/PDF）或生成可共享的 docs 站点结构。
- 与 Server/Agent 集成：让分析结果生成结构化 wiki bundle，并由 Extension 写入 `.deepsight/wiki`（保留人工编辑与冲突处理）。

## 风险与注意事项

- CSP 当前较严格，任何“动态图渲染/外部资源加载”都需要谨慎设计。
- 文件监听在多工作区/大量文件变更时可能产生抖动；已加 debounce，但未来可能需要更细粒度的更新策略。
