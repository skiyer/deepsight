# Wiki 自动生成设计草案 - 评审意见

日期：2026-01-26
评审人：Claude Code
评审状态：通过（需补充）

---

## 1. 整体评价

草案设计合理，与现有架构对齐良好。安全渗透专家的定位和"可用但不完美"的预期管理很务实。核心架构方案符合当前系统分工，可行性高。

**建议**：草案可直接作为设计文档进行技术实现，但需补充以下细节。

---

## 2. 与现有实现的对齐检查

### 2.1 已确认对齐点 ✅

| 对齐项 | 当前状态 | 说明 |
|--------|----------|------|
| Wiki MVP 已完成 | ✅ | `.deepsight/wiki/*.md` + `index.json` + 文件监听 |
| server 使用 agent-sdk | ✅ | `server/src/agent.ts` 已有 `query()` 封装 |
| 工具限制 | ✅ | 已限制 `Read/Glob` |
| 写盘由 Extension 完成 | ✅ | 符合草案架构 |

### 2.2 需要确认的细节

1. **6 个固定页面具体是哪几个？**
   - 草案提到：Home, Architecture, Modules, Dataflow, TrustBoundaries, AttackSurface
   - 建议在文档中明确每个页面的模板/期望结构

2. **当前是否有命令定义？**
   - 需检查 `extension/package.json` 中是否已有相关 commands
   - 建议统一在 `contributes.commands` 中定义

---

## 3. 架构方案评审

### 3.1 推荐：三段式流水线 ✅

```
Extension 发起 → Server 读取生成 → Extension 落盘
```

**优点**：
- 符合当前 `server` 只读、Extension 写盘的分工
- 天然适配远端 `serverUrl` 场景
- SSE 逐页发送实现增量预览

**技术可行性**：高

### 3.2 路由复用建议

| 方案 | 优点 | 缺点 |
|------|------|------|
| 复用 `/analyze` | 改动最小 | 逻辑混杂，状态语义混乱 |
| 新建 `/wiki/generate` | 职责清晰，语义明确 | 需要新增路由文件 |

**建议**：新建 `POST /wiki/generate`，保持职责分离。

---

## 4. 安全设计评审

### 4.1 已覆盖的风险点 ✅

- 首次生成弹窗确认
- 排除目录：`node_modules/.git/dist/build`
- 文件大小与数量上限
- front matter 审计信息

### 4.2 补充建议

#### 4.2.1 敏感路径保护

```typescript
// 建议新增配置
interface WikiGenerationConfig {
  // 现有
  excludePatterns: string[];
  maxFilesRead: number;
  maxTokens: number;

  // 新增
  sensitivePaths: string[]; // e.g., [".env", "**/credentials.json"]
}
```

#### 4.2.2 Token 预算控制

- 建议在请求前估算本次生成的 token 消耗
- 超过阈值则拒绝或降级（仅生成核心页面）

#### 4.2.3 审计日志

- 建议输出到 `DeepSight Debug` channel
- 记录：`serverUrl`、`filesRead`、`tokensUsed`、`pagesGenerated`

---

## 5. 交互设计评审

### 5.1 命令面板入口 ✅

建议的三个命令合理：
- `DeepSight: Generate Wiki (Full)`
- `DeepSight: Generate Wiki (Current Page)`
- `DeepSight: Cancel Wiki Generation`

**需确认**：
- 当前 `package.json` 中 commands 的位置
- 是否有图标需求

### 5.2 Webview 按钮优先级

| 里程碑 | Webview 按钮 | 评审意见 |
|--------|--------------|----------|
| M1 | ❌ 不需要 | 命令面板足够 |
| M2 | ✅ 需要 | 用户体验更好 |

**建议**：M1 先做命令面板，Webview 按钮作为 M2 迭代。

### 5.3 冲突检测（US-03）简化方案

完整 hash 比对较复杂，MVP 阶段建议简化：

```typescript
interface WikiFrontMatter {
  generatedBy: "deepsight";
  generatedAt: string;  // ISO timestamp
  // 新增
  contentHash?: string;  // 简化版：文件内容 hash
  manualEdited?: boolean; // 用户标记
}
```

**MVP 简化策略**：
1. 检测 `generatedBy` 字段
2. 无该字段 → 弹窗确认是否覆盖
3. 有该字段 → 直接覆盖（后续迭代再加细粒度检测）

---

## 6. 技术风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 超大仓库 SSE 超时 | 中 | 高 | 分阶段生成，Home/Trust/AttackSurface 优先 |
| JSON 合约解析失败 | 中 | 中 | server 侧添加 schema 校验，捕获解析错误 |
| 取消后 agent 继续运行 | 中 | 中 | SDK query() 支持 abortSignal |
| 用户并发编辑 wiki | 低 | 中 | 文件锁或提示"文件已被外部修改" |

### 6.1 SSE 取消机制

```typescript
// Extension 侧
const controller = new AbortController();
serverRequest.signal = controller.signal;

// Cancel 命令
controller.abort();
```

### 6.2 JSON 校验建议

```typescript
import { z } from "zod";

const WikiPageSchema = z.object({
  type: z.literal("wiki_page"),
  path: z.string(),
  title: z.string(),
  frontMatter: z.object({
    title: z.string(),
    created: z.string().datetime(),
    updated: z.string().datetime(),
    generatedBy: z.literal("deepsight"),
    confidence: z.enum(["low", "medium", "high"]),
  }),
  markdown: z.string(),
});
```

---

## 7. 遗漏事项

### 7.1 前端进度展示

当前 Webview 是否有进度组件？

| 组件 | 状态 | 建议 |
|------|------|------|
| Skeleton | ✅ 已有 | 可复用 |
| 进度条 | ❌ 无 | 新增 `ProgressBar.tsx` |
| 状态文字 | ⚠️ 部分 | 新增状态文案 |

### 7.2 错误处理矩阵

| 错误场景 | 当前处理 | 建议 |
|----------|----------|------|
| agent 超时 | ? | 统一错误事件 |
| 读文件失败 | ? | 记录日志，继续生成 |
| JSON 解析失败 | ? | 跳过该页，记录错误 |
| 写盘失败 | ? | 中断并提示 |

### 7.3 并发场景

生成过程中用户打开并编辑 wiki 文件：
- 建议：检测到文件变化时提示"文件已被修改，是否重新加载？"

---

## 8. 优先级调整建议

### 当前建议

| 优先级 | 特性 | 理由 |
|--------|------|------|
| P0 | 命令面板全量生成 | MVP 核心功能 |
| P0 | SSE 路由 + 落盘 | 基础设施 |
| P1 | Cancel 命令 | 关键体验 |
| P1 | 进度展示 | 用户体验 |
| P2 | 冲突保护 | 复杂度较高 |
| P2 | 范围选择 UI | 可用默认值 |
| P3 | Webview Generate 按钮 | 锦上添花 |

### 建议里程碑

```
M1（本次）:
- [x] 命令面板全量生成
- [x] POST /wiki/generate SSE
- [x] Extension 落盘
- [x] Cancel 机制

M2（后续）:
- [ ] 进度展示 UI
- [ ] 当前页生成
- [ ] 冲突保护（简化版）

M3（迭代）:
- [ ] 范围选择 UI
- [ ] Webview Generate 按钮
- [ ] 完整冲突检测
```

---

## 9. 待补充细节

1. **6 个固定页面的模板结构**
   - 每个页面期望包含哪些 section
   - 示例 front matter 和大纲

2. **WIKI_PROMPT 草稿**
   - 当前的 `server/src/prompts.ts` 已有什么
   - 新的 system prompt 需要哪些约束

3. **配置项定义**
   - `deepsight.wiki` 配置节点
   - 默认值：排除模式、敏感路径、限制参数

4. **测试策略**
   - 小型测试仓库
   - 超大仓库模拟（可选）

---

## 10. 结论

**评审结果**：通过，建议继续细化后实施。

**下一步行动**：
1. 补充 6 个固定页面的模板结构
2. 在 `server/src/routes/` 下新建 `wiki.ts` 路由骨架
3. 在 `extension/package.json` 中预埋 commands
4. 编写 `WIKI_PROMPT` system prompt 草稿

---

## 附录：检查清单

- [x] 架构与现有代码对齐
- [x] 安全风险已识别并有缓解措施
- [x] 用户交互路径清晰
- [x] SSE 事件定义完整
- [x] JSON 合约明确
- [ ] 6 个固定页面模板（待补充）
- [ ] WIKI_PROMPT 草稿（待补充）
- [ ] 配置项定义（待补充）
