这是一份基于 **Unix 哲学**与 **KISS 原则（Keep It Simple, Stupid）** 整合后的 DeepSight Wiki 自动生成设计评审意见稿。该意见稿旨在通过最简的架构实现最高效的价值交付。

---

# DeepSight Wiki 自动生成设计评审意见稿

**版本：** 1.0 (Final Review)
**评审结论：** **通过 (Approved with Simplifications)**
**核心思想：** 计算与 IO 分离；文件系统即真相；Markdown 即协议。

---

## 1. 总体评估
本方案设计的“三段式流水线”（Extension 发起 -> Server 推理 -> Extension 落盘）完全符合 DeepSight 插件化、前后端分离的架构现状。MVP 阶段应聚焦于**“生成可用的初稿”**而非“完美的自动化系统”，需警惕过度工程化（Over-engineering）。

---

## 2. 架构设计优化 (Unix 视角)

### 2.1 职责边界
*   **Server (计算/推理层)：** 保持**无状态**。只负责读取代码上下文并产出文本。不涉及任何版本校验或文件 IO。
*   **Extension (IO/状态层)：** 作为**唯一事实来源**。负责管理 SSE 连接、UI 进度展示及原子化写盘。
*   **文件系统 (持久化层)：** 它是唯一的同步机制。不要在内存中维护复杂的“生成状态机”。

### 2.2 协议简化 (SSE)
拒绝复杂的 JSON 嵌套，SSE 事件应精简为三种：
1.  `progress`: `{ "message": "正在分析架构...", "percent": 30 }` —— 用于 UI 反馈。
2.  `page`: `{ "path": "Architecture.md", "content": "..." }` —— 传输完整的 Markdown（含 Frontmatter）。
3.  `error`: `{ "code": "...", "message": "..." }` —— 异常中断处理。

---

## 3. 核心功能设计 (KISS 原则)

### 3.1 冲突保护：人机协作边界
无需引入“版本向量”或“哈希校验”。采用最简的 **Metadata 标记法**：
*   **策略：** 写盘前检查文件 Frontmatter。
*   **逻辑：**
    *   若文件不存在：直接写入。
    *   若包含 `generatedBy: deepsight`：视为机器页面，直接覆盖。
    *   若**不包含**该标记：视为人工编辑过，弹窗提示用户“是否覆盖自定义内容？”。

### 3.2 质量保证：证据链条而非自动验证
不要构建复杂的 Agent 验证层，改用 **“文内证据引用”**：
*   **强制约束：** 在 System Prompt 中要求每个页面必须包含 `## 证据引用 (Evidence)` 章节。
*   **价值：** 将“核实幻觉”的成本交还给安全专家（用户），这符合 Unix“提供工具而非代替决策”的理念。

### 3.3 固定页面集定义 (MVP Scope)
专注于 6 个核心视图，每个页面采用“强制大纲”模式：
1.  **Home.md**: 索引与项目全貌。
2.  **Architecture.md**: 组件关系与物理布局。
3.  **Modules.md**: 逻辑模块功能拆解。
4.  **Dataflow.md**: 关键数据流向与 Sink 点。
5.  **TrustBoundaries.md**: 输入源、权限边界。
6.  **AttackSurface.md**: 攻击面枚举与风险点。

---

## 4. 安全与合规

### 4.1 最小化读取
*   **复用规则：** 默认强制遵循工作区的 `.gitignore`。
*   **硬编码排除：** 默认排除 `.env`, `*.pem`, `node_modules`, `.git` 等敏感/噪音目录。
*   **用户确认：** 首次生成前，明确告知用户“代码片段将发送至 <serverUrl> 进行分析”。

---

## 5. 实施路线图 (Simplified Roadmap)

### M1: 核心链路打通 (当前目标)
*   **Extension:** 实现 `Generate Wiki (Full)` 命令，处理 SSE 接收与原子写盘。
*   **Server:** 编写 `WIKI_PROMPT`，实现基于 `Read/Glob` 的只读生成路由。
*   **UI:** 基础的 `withProgress` 进度条展示。

### M2: 健壮性增强
*   **取消机制:** 完善 `AbortController` 链路，确保取消生成能实时停止 Server 端 Agent。
*   **冲突弹窗:** 实现前述的“人工修改检测”逻辑。

### M3: 体验优化 (按需)
*   **当前页生成:** 仅针对单个 `.md` 触发增量更新。
*   **Webview 交互:** 在 Wiki 预览页增加“重新生成”悬浮按钮。

---

## 6. 评审总结
**“少即是多”。** 该 Wiki 生成系统的核心价值在于为渗透专家省去前 2 小时的代码盲读时间。我们应当交付一个**透明、可预测、易于干预**的文本工具，而不是一个复杂的、试图理解一切的黑盒。

**Action Items:**
1.  定义 `WIKI_PROMPT` 的强制 JSON 输出合约。
2.  在 Extension 中实现基于 `generatedBy` 标记的写盘保护逻辑。
3.  确定 SSE 路由 `/wiki/generate` 的超时与断开处理机制。
