# 📄 设计文档：Claude CodeLens - 智能代码透视插件
**项目代号：** DeepSight
**版本：** v1.0
**设计核心：** Chatless UI (去对话框化) | Click-to-Action (点击即达) | Context-Aware (上下文感知)

---

## 1. 产品概述 (Overview)
本插件旨在为 VS Code 提供一种原生、无侵入的 AI 辅助体验。摒弃传统的“侧边栏聊天窗口”，将 AI 能力封装为 UI 按钮。用户通过点击代码定义处的 **CodeLens**，在 **侧边栏** 获取结构化的解释文档或安全审计报告。

### 核心价值
*   **零 Prompt 负担：** 用户无需构思提示词，点击按钮即可。
*   **深度隐式分析：** 数据流分析（Data Flow）不作为独立功能存在，而是作为底层能力，自动融入到“解释”和“审计”的结果中。
*   **原生融合：** UI 深度集成至 IDE 编辑器，如同原生功能。

---

## 2. 界面布局架构 (UI Architecture)

界面分为两个主要区域：**触发区 (Editor Area)** 和 **展示区 (Sidebar Area)**。

### 2.1 触发区：CodeLens
*   **位置：** 仅出现在 **Class (类)**、**Function (函数)**、**Global Variable (全局变量)** 的定义行上方。
*   **样式：** VS Code 原生灰色小字，鼠标悬停高亮。
*   **按钮组：**
    ```text
    [ ✨ 解释 (Explain) ]  |  [ 🛡️ 安全审计 (Audit) ]
    ```

### 2.2 展示区：专用侧边栏 (Secondary Sidebar)
*   **位置：** 建议默认放置在右侧边栏，与左侧文件树分离，便于对照阅读。
*   **结构：**
    1.  **Top Bar (固定头)：** 状态指示与参数控制。
    2.  **Scroll View (内容区)：** 动态渲染的分析卡片。
    3.  **Footer (可选)：** 反馈按钮（赞/踩）。

---

## 3. 功能模块详细设计

### 3.1 全局控制栏 (Top Bar)
位于侧边栏顶部，始终固定。

*   **当前锚点 (Current Anchor)：**
    *   显示：`📍 [图标] 对象名称` (例如：`📍 func process_payment`)
    *   交互：点击可使编辑器光标跳回该函数定义处。
*   **参数设置 (Settings)：**
    *   **分析范围 (Scope)：** `[🔘 单文件]` / `[⚪ 全项目]`
        *   *逻辑：* 单文件速度快；全项目会触发跨文件引用分析（耗时较长）。
    *   **输出语言 (Lang)：** `[🇨🇳 中]` / `[🇺🇸 En]`

### 3.2 功能模式 A：智能解释 (Smart Explanation)
*触发条件：点击“✨ 解释”*

侧边栏渲染为一份“动态技术文档”。

*   **模块 1：核心摘要 (The Gist)**
    *   使用 Markdown 渲染一段简洁的业务逻辑描述。
*   **模块 2：数据链路透视 (Data Context) —— *核心差异点***
    *   *此处展示隐式的数据流分析结果。*
    *   **📥 输入来源 (Inputs):** 列出参数来源、读取的全局变量、读取的配置文件。
        *   *样式：* `变量名` (来自 `文件名:行号`) `[跳转图标]`
    *   **📤 依赖与副作用 (Dependencies & Effects):**
        *   调用了哪些外部服务（DB, API）。
        *   修改了哪些全局状态。
*   **模块 3：代码结构导航 (Structure)**
    *   以步骤条形式展示主要逻辑分支。

### 3.3 功能模式 B：安全审计 (Security Audit)
*触发条件：点击“🛡️ 安全审计”*

侧边栏渲染为一份“漏洞扫描报告”。

*   **模块 1：健康度仪表盘 (Health Dashboard)**
    *   显示大图标状态：
        *   🟢 **SAFE** (通过)
        *   🟡 **WARNING** (警告 - 代码异味/轻微风险)
        *   🔴 **CRITICAL** (高危 - 注入/泄露/越权)
*   **模块 2：漏洞详情卡片 (Vulnerability Detail)**
    *   *仅在发现问题时显示。*
    *   **标题：** 漏洞类型 (例如：SQL Injection)
    *   **攻击路径追踪 (Attack Vector Trace):**
        *   *利用数据流分析展示脏数据如何传播。*
        *   UI 样式：垂直时间轴。
        *   1️⃣ Source: `user_input` (外部传入)
        *   ⬇️
        *   2️⃣ Propagation: 传入 `format_query()`
        *   ⬇️
        *   3️⃣ Sink: `db.execute()` (未过滤)
    *   **修复方案 (Fix):**
        *   提供代码 Diff 预览。
        *   操作按钮：`[ 🔧 自动修复 (Apply Fix) ]`

---

## 4. 交互与状态反馈 (Interaction & Feedback)

由于没有对话流，**过程反馈**至关重要。

### 4.1 点击响应
1.  用户点击 CodeLens 中的 `✨ 解释`。
2.  CodeLens 文字立即变为 `⏳ 分析中...` (防止重复点击)。
3.  侧边栏旧内容清空。

### 4.2 加载状态 (Loading State)
侧边栏显示 **骨架屏 (Skeleton Screen)** + **动态状态文本**。
*   *状态文本示例：*
    *   "正在解析 AST..."
    *   "正在追踪变量 `user_id` 的跨文件引用..." (当开启全项目模式时)
    *   "正在生成最终报告..."

### 4.3 链接跳转 (Navigation)
侧边栏中所有的“文件名”、“函数名”、“变量名”都必须是**可点击的超链接**。
*   **技术实现：** 链接触发 VS Code 内部命令 `editor.action.revealDefinition`，带上 `{filePath, lineNumber}` 参数。

---

## 5. 视觉原型示意 (Visual Mockup)

```text
+---------------------------------------------------------------+
| VS CODE EDITOR AREA                                           |
+---------------------------------------------------------------+
| ...                                                           |
| [ ✨ 解释 ]  |  [ 🛡️ 安全审计 ]  <-- CodeLens (Trigger)     |
| class UserAuthenticator:                                      |
|     def login(self, credentials):                             |
|         ...                                                   |
|                                                               |
+---------------------------------------------------------------+

+---------------------------------------------------------------+
| SECONDARY SIDEBAR (OUTPUT)                                    |
+---------------------------------------------------------------+
| [HEADER]                                                      |
| 📍 class UserAuthenticator            ⚙️ [全项目] [中文]      |
| ------------------------------------------------------------- |
| [CONTENT - AUDIT MODE]                                        |
|                                                               |
|  [ICON: 🔴] 发现高危漏洞 (Critical)                           |
|                                                               |
|  🔴 敏感数据日志泄露 (Sensitive Data Leak)                    |
|  -------------------------------------------                  |
|  攻击路径 (Trace):                                            |
|   1. Source: arg `credentials` (包含 password)                |
|      ↓                                                        |
|   2. Sink: `logger.info(credentials)` (Line 42)               |
|                                                               |
|  💡 修复建议:                                                 |
|  使用 filters 屏蔽 password 字段。                            |
|                                                               |
|  [ < > Code Diff View ]                                       |
|  [ 🔧 应用修复 ]                                              |
|                                                               |
+---------------------------------------------------------------+
```

---

## 6. 开发实施建议 (Implementation Notes)

1.  **CodeLens Provider:**
    *   使用 `vscode.CodeLensProvider` 接口。
    *   仅对 `SymbolKind.Class`, `SymbolKind.Function`, `SymbolKind.Variable` (Global scope only) 返回 CodeLens。
2.  **侧边栏视图:**
    *   使用 `vscode.WebviewViewProvider` 以支持复杂的 HTML/CSS 渲染（卡片、时间轴、Diff视图）。
3.  **Prompt 工程策略:**
    *   **Prompt 必须包含两步：**
        1.  **Context Fetching:** 插件先分析 AST，若开启“全项目”，先在本地搜索相关引用。
        2.  **LLM Generation:** 将代码 + 引用上下文发给 Claude，并强制要求返回 JSON 格式数据（包含 summary, data_flow_steps, vulnerabilities list），以便前端渲染为 UI 卡片，而不是纯文本。

