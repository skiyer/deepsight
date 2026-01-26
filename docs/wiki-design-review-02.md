# Wiki 自动生成设计草案 - 专业架构师评审意见

**评审版本**: wiki-auto-generation-claude-draft.md (2026-01-26)
**评审人**: Claude Code（架构师模式）
**评审日期**: 2026-01-26
**信心等级**: High（与现有架构对齐良好）

---

## 一、整体架构评估

### 1.1 架构设计洞察

该设计方案体现了**良好的架构嗅觉**：

**✅ 核心设计哲学正确**
- **三段式流水线**（Extension发起 → Server生成 → Extension落盘）完美契合当前系统分工
- **只读生成策略**（server只读不写）与 DeepSight 的远端 serverUrl 场景无缝衔接
- **状态下沉到 Extension** 保留了"Extension 是单一事实来源"的核心设计

**✅ 非目标界定清晰**
- "不直接写文件"的边界意识体现了对生产安全的深刻理解
- "固定页面集"的选择是对 MVP 复杂度的合理约束

**✅ 威胁建模到位**
- 明确识别 serverUrl 可配置带来的数据泄露风险
- 敏感路径保护、token 预算控制等缓解措施有深度

---

## 二、关键风险与架构改进建议

### 2.1 深层次风险：生成质量不确定性

**风险描述**：当前草案将生成质量完全依赖于单次 LLM 调用。在超大代码库场景（如 Chromium），存在**事实幻觉**、**遗漏关键组件**、**错误理解调用关系**等质量风险。

**架构师建议**：

#### 方案 A：增量验证架构（推荐）
```typescript
// 在 SSE 协议中增加验证阶段
// Server 侧：
{
  "event": "page_draft",
  "data": {
    "type": "wiki_page",
    "path": "Architecture.md",
    "markdown": "...",
    "validationNeeded": true,  // 新增
    "evidenceList": [          // 新增：agent 的证据来源
      { "file": "src/core/router.ts", "symbols": ["routeHandler", "middleware"] },
      { "file": "src/auth/jwt.ts", "symbols": ["verifyToken"] }
    ]
  }
}

// Extension 侧增加验证层：
// 1. 对 evidenceList 做二次校验（文件存在性、符号存在性）
// 2. 若校验失败，发送 `POST /wiki/regenerate` 带失败原因
// 3. Server 侧做增量修正
```

**收益**：
- 将 LLM 的"黑盒生成"转化为"可验证的知识提取"
- 利用 VS Code 的符号索引能力（LSP）做轻量级事实校验
- 符合安全审计的"证据驱动"方法论

#### 方案 B：分层生成策略
对超大仓库，将生成分为两层：
1. **概览层**（P0）：先扫顶层目录结构、README、package.json、API 文档 → 产出 Home/Architecture
2. **细节层**（P1）：针对概览层识别出的关键模块，深度扫描 → 产出 Modules/Dataflow

**SSE 协议扩展**：
```typescript
// 支持分阶段请求
{
  "scope": {
    "strategy": "two-pass",  // "full" | "two-pass"
    "maxDepth": 2           // 第一层只扫 2 层目录
  }
}
```

---

### 2.2 并发场景：状态竞争

**潜在风险**：
- 用户 A 在 Extension 生成 Wiki 的同时，用户 B（或其他工具）修改 `.deepsight/wiki/Architecture.md`
- 当前草案的 watcher 会触发自动刷新，但**可能展示的是中间态或不一致态**

**架构师建议**：

引入**生成会话锁**与**版本向量**：

```typescript
// Extension 侧状态管理
interface WikiGenerationState {
  sessionId: string;           // 本次生成会话 ID
  lockedPages: Set<string>;    // 当前正在生成的页面
  versions: Map<string, {      // 版本追踪
    current: number;
    onDisk: number;
  }>;
}

// 写盘策略：
// 1. 生成前：读取当前文件版本号 → versions.onDisk
// 2. 生成中：versions.current++，并写入 front matter
// 3. 写盘时：若 onDisk ≠ current，说明外部修改 → 冲突弹窗

// front matter 示例：
---
title: Architecture
version: 3                      # 版本号
generatedBy: deepsight
generatedAt: 2026-01-26T10:00:00Z
lastModifiedBy: user            # 新增：区分人工 vs 生成
---
```

---

### 2.3 可观测性盲区

当前草案的日志与监控维度不足，生产环境排障困难。

**架构师建议**：构建**生成质量可观测性三层体系**

#### 层 1：执行日志（已有草案基础）
```typescript
// DeepSight Debug Channel
[WikiGeneration #${sessionId}]
├── Phase: scanning (10 files matched, 3 excluded)
├── Phase: drafting Architecture.md (tokens: 1523)
├── Phase: drafting TrustBoundaries.md (tokens: 891)
├── Phase: writing (6/6 pages completed)
└── Summary: duration=125s, totalTokens=8456, confidence={high:3, medium:2, low:1}
```

#### 层 2：质量指标（front matter 扩展）
每个页面记录元数据：
```yaml
---
metrics:
  filesRead: 12
  symbolsReferenced: 45
  confidence: medium
  coverage:           # 覆盖率自评
    estimated: 0.7    # agent 估算的代码覆盖度
    blindSpots:       # 明确声明未覆盖的区域
      - "src/plugins/**"
      - "test/**"
  hallucinations: []  # 后续迭代：人工标记的幻觉项
---
```

#### 层 3：长期质量追踪（index.json 扩展）
```json
{
  "pages": [...],
  "generationHistory": [
    {
      "sessionId": "sess_123",
      "timestamp": "2026-01-26T10:00:00Z",
      "model": "claude-opus-4-5",
      "pagesGenerated": 6,
      "totalTokens": 8456,
      "userCancelled": false,
      "qualityScore": 0.82   // 后续：基于人工修正的自动评分
    }
  ]
}
```

---

## 三、细节深化建议

### 3.1 6 个固定页面的模板结构

评审意见中提到需要补充。建议采用**强制大纲 + 可选章节**模式：

```typescript
// server/src/templates/wiki-pages.ts

export const WIKI_PAGE_TEMPLATES = {
  "Home.md": {
    requiredSections: [
      "## 1. 项目概述",
      "## 2. 安全审计目标",
      "## 3. 文档导航"
    ],
    optionalSections: [
      "## 4. 已知安全假设",
      "## 5. 参考链接"
    ]
  },

  "Architecture.md": {
    requiredSections: [
      "## 1. 技术栈与依赖",
      "## 2. 部署架构",
      "## 3. 核心组件",
      "## 4. 数据存储",
      "## 5. 证据清单"  // 必须列出引用的文件与符号
    ]
  },

  "TrustBoundaries.md": {
    requiredSections: [
      "## 1. 信任边界图（mermaid）",
      "## 2. 用户输入入口",
      "## 3. 外部依赖信任",
      "## 4. 权限模型",
      "## 5. 证据清单"
    ]
  },

  "AttackSurface.md": {
    requiredSections: [
      "## 1. API 接口",
      "## 2. 文件处理",
      "## 3. 网络通信",
      "## 4. 第三方集成",
      "## 5. 潜在风险点",
      "## 6. 证据清单"
    ]
  }
};
```

**Prompt 约束**：在 `WIKI_PROMPT` 中明确要求：
- "You MUST include all required sections"
- "If evidence is insufficient, set confidence: low and list blindSpots"

---

### 3.2 SSE 协议精细化

当前草案的 SSE 事件较简单，建议增强：

```typescript
// 1. progress 事件增强
event: progress
data: {
  "phase": "drafting",
  "page": "Architecture.md",
  "pct": 35,
  "tokensUsed": 1523,
  "estimatedTotalTokens": 8000,
  "message": "Analyzing src/core/**"
}

// 2. 新增 validation 事件
event: validation
data: {
  "page": "Architecture.md",
  "checks": [
    {
      "type": "evidence_exists",
      "file": "src/core/router.ts",
      "status": "pass"
    },
    {
      "type": "evidence_exists",
      "file": "src/nonexist.ts",
      "status": "fail",
      "suggestion": "Agent hallucinated this file"
    }
  ]
}

// 3. page_draft 数据结构增强
event: page_draft
data: {
  "type": "wiki_page",
  "path": "Architecture.md",
  "title": "Architecture",
  "frontMatter": { /* ... */ },
  "markdown": "...",
  "stats": {                    // 新增
    "filesRead": 12,
    "tokensUsed": 1523,
    "generationTimeMs": 2847
  },
  "qualityFlags": {             // 新增
    "hasEvidenceList": true,
    "hasConfidenceMarker": true,
    "coverageDeclared": true
  }
}
```

---

### 3.3 配置体系

```typescript
// extension/package.json 的 contributes.configuration

"deepsight.wiki.generation": {
  "type": "object",
  "properties": {
    "excludePatterns": {
      "type": "array",
      "default": ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
      "description": "Glob patterns to exclude from scanning"
    },
    "sensitivePaths": {
      "type": "array",
      "default": [".env", ".env.*", "**/*.key", "**/credentials.json"],
      "description": "Sensitive files that should never be read"
    },
    "maxFilesRead": {
      "type": "number",
      "default": 100,
      "description": "Maximum files to read per generation"
    },
    "maxTokensPerPage": {
      "type": "number",
      "default": 4000,
      "description": "Token budget per wiki page"
    },
    "strategy": {
      "type": "string",
      "enum": ["full", "two-pass"],
      "default": "full",
      "description": "Generation strategy for large repositories"
    },
    "confidenceThreshold": {
      "type": "string",
      "enum": ["low", "medium", "high"],
      "default": "medium",
      "description": "Minimum confidence to include in wiki"
    }
  }
}
```

---

## 四、测试策略建议

### 4.1 分层测试矩阵

| 层级 | 测试场景 | 工具 | 通过标准 |
|------|----------|------|----------|
| **单元** | JSON schema 校验、路径过滤 | Vitest | 100% 覆盖 |
| **集成** | SSE 端到端、取消机制 | VS Code Test API | 95% 覆盖 |
| **系统** | 小规模真实仓库（< 50 文件） | 手动 + 自动化 | 5 个关键页面生成完整 |
| **性能** | Chromium 量级（10 万文件） | 手动 | 至少产出 Home/Trust/AttackSurface，不崩溃 |
| **安全** | 敏感路径绕过测试 | 手动 | 所有敏感文件均未被读取 |

### 4.2 质量评估基准集

建议建立 **"Wiki 生成质量评估仓库"** （作为独立 git repo）：

```
test-wiki-quality/
├── cases/
│   ├── trivial/          # 10 文件，清晰分层
│   ├── medium/           # 100 文件，微服务架构
│   └── complex/          # 500+ 文件，混合技术栈
├── expected/             # 人工编写的基线 wiki
├── evaluation-script/    # 自动比对工具
└── scoring-rubric.md     # 评分标准（完整性、准确性、幻觉率）
```

**评估指标**：
- **模块覆盖率**：agent 提到了多少实际存在的核心模块
- **幻觉率**：引用了多少不存在的文件或符号
- **证据完整度**：每个断言是否有文件引用
- **安全洞察深度**：识别出的攻击面是否真实存在

---

## 五、长期演进思考（超出 MVP）

### 5.1 从"一次性生成"到"持续同步"

当前草案是单次批处理。未来可演进为：

```
.watch("**/*.ts")
→ 文件变更 → 增量生成受影响页面
→ 产出 "Change Impact Report"
→ 在 wiki 中新增 "## 6. Recent Changes" 章节
```

**技术路径**：
1. 利用 VS Code 的 FileSystemWatcher
2. 维护依赖关系图（file → wiki sections）
3. 评估变更的"安全影响半径"（AST 分析）

### 5.2 从"单模型"到"多智能体协作"

当前草案依赖单模型。可演进为：

```
Agent-1 (Router): 分析入口文件，识别模块边界
Agent-2 (Module Expert): 深度分析单个模块
Agent-3 (Security Auditor): 专注信任边界与攻击面
→ 由 Extension 合并产出
```

**收益**：
- 每个 agent 可独立失败/重试
- 支持不同模型（Opus 4.5 做架构，Sonnet 做模块细节）
- 并行生成，提升速度

---

## 六、实施路径建议

### M1（当前冲刺）：MVP 核心

**目标**：命令面板全量生成 + 基础 SSE + 原子落盘
**风险**：Prompt 质量不稳定 → 产出不可用

**缓解**：
- 先在 `test-wiki-quality/trivial` 上打磨 WIKI_PROMPT
- 与 6 个页面模板同步迭代
- 接受 P0 阶段有 30% 页面需手工修正

### M2（紧接着）：体验与健壮性

**目标**：进度展示 + Cancel + 简化冲突保护
**风险**：SSE 超时/取消后 agent 仍在后台运行

**缓解**：
- 必须实现 AbortSignal 传递
- Server 侧增加 `/wiki/status` 查询接口（用于诊断僵尸任务）

### M3（后续迭代）：可观测性与质量

**目标**：
- 证据清单自动校验（层1可观测性）
- front matter 质量指标（层2）
- index.json 历史追踪（层3）

**关键决策**：是否引入向量数据库存储生成历史 → 评估复杂度

---

## 七、专业架构师最终建议

### ✅ **批准进入技术实现，但附加条件**：

1. **必须补充的文档**（技术债，3 天内完成）：
   - 6 个固定页面的强制大纲 + 示例 front matter
   - WIKI_PROMPT 草稿（与模板联动）
   - SSE 协议的完整 TypeScript interface 定义

2. **架构债务（可接受，M2 必须还）**：
   - 当前无版本向量 → M2 必须引入简易冲突检测
   - 当前无可观测性 → M2 至少实现层1（执行日志）

3. **M1 成功的衡量标准**：
   - 在 DeepSight 自身代码库上生成 6 个页面
   - 人工评审：至少 4/6 页面的安全洞察是"可用但不完美"
   - 无幻觉文件引用（幻觉符号可接受 < 5%）
   - 可 Cancel 且 3 秒内停止

### ⚠️ **短期不建议投入（超出 MVP）**：
- 多智能体架构（ROI 低，单模型尚不稳定）
- 增量持续同步（需求不明确，怕过度设计）
- 完整冲突检测 hash 比对（M1 用 generatedBy 标记足够）

**M1 成功之后**，建议先聚焦于：
- 质量评估基准集建立（量化生成质量）
- Prompt 优化与模板迭代
- 安全敏感路径的用户反馈收集

---

**评审版本**: wiki-auto-generation-claude-draft.md (2026-01-26)
**评审人**: Claude Code（架构师模式）
**评审日期**: 2026-01-26
**信心等级**: High（与现有架构对齐良好）
