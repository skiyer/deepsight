# Server Testing & TDD Guide

## 目标
- 让 `server/` 的核心逻辑与路由都具备可回归的测试
- 建议遵循 TDD（Red → Green → Refactor）流程交付新增功能

## 运行测试
```bash
pnpm -C server test
pnpm -C server test:watch
pnpm -C server test:coverage
```

## 测试分层
- **Unit**：纯函数、参数校验、SDK 消息映射等（`tests/unit`）
- **Integration**：路由与 SSE 契约（`tests/integration`）

## TDD 工作流建议
1. **Red**：先写失败的测试用例，明确预期行为
2. **Green**：用最小改动让测试通过
3. **Refactor**：重构实现与测试，保持行为不变

## 新增功能提交要求（建议）
- 新功能或 Bug Fix 必须附带测试
- 保持 `pnpm -C server test` 通过
- 逐步提高覆盖率（建议 80% 作为起点）
