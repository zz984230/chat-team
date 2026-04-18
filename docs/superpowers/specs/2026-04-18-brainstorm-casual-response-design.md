# 头脑风暴模式：简单输入直接回应

**日期**：2026-04-18
**状态**：已批准

## 问题

当前头脑风暴模式对所有输入一视同仁：用户输入"你好"或"什么是微服务？"等简单问题，系统仍执行完整的多轮讨论 + writer 综合流程，产出正式文档。这既浪费资源，又给出不自然的体验。

## 目标

头脑风暴模式下，如果用户输入不涉及需要深入讨论的需求，各 agent 以角色身份直接回应；复杂需求仍走完整的头脑风暴流程。

## 方案：后端分类 + 双流程分支

### 分类机制

在 `_run_brainstorm_workflow` 开始时，用 claude CLI + haiku 模型做一次轻量分类判断：

- 新增 `_classify_input(requirement) -> bool` 方法（True=复杂，False=简单）
- 分类 prompt：`"判断以下输入是否需要深入分析和多轮讨论。如果只是打招呼、简单提问、闲聊，回复 SIMPLE。如果是复杂需求、技术方案、需要分析的议题，回复 COMPLEX。输入：{requirement}"`
- 使用 haiku 模型降低延迟和成本
- 超时 10 秒，超时或异常默认走完整流程（安全降级）

### Phase 结构

- `create_session` 时仍创建 2 个 phase（头脑风暴 + 整合输出），与现有逻辑一致
- `execute_session` 时根据分类结果：
  - **SIMPLE**：执行 phase 1（单轮并行，所有 agent），跳过 phase 2（标记为 SKIPPED）
  - **COMPLEX**：执行完整流程（多轮讨论 + writer 综合），不变
- `PhaseStatus` 新增 `SKIPPED = "skipped"` 状态

### 简单流程（SIMPLE 分支）

- 只执行 phase 1，所有 agent（analyst、architect、writer）单轮并行
- 每个 agent 使用各自的 `casual_prompt` 替代 `system_prompt`，不附加 `output_template`
- 任务 prompt：`"请以你的角色身份直接回应以下内容：{用户原始输入}"`
- Writer 以自身角色回应，不做汇总
- 每个 agent 产出各自的 markdown 文件
- Phase 2 标记为 SKIPPED

### 复杂流程（COMPLEX 分支）

与现有 `_run_brainstorm_workflow` 完全一致，不做修改。

### 数据模型变更

**`workflow/models.py`**：
- `PhaseStatus`：新增 `SKIPPED = "skipped"`
- `AgentDefinition`：新增 `casual_prompt: str | None = None`

**`vault/agents/*.yaml`**：
- 每个 agent 新增 `casual_prompt` 字段：

```yaml
# analyst.yaml
casual_prompt: |
  你是一位需求分析师。现在有个简单的问题需要你以自己的专业视角回应。
  请用轻松对话的方式回答，不需要写正式文档。保持你作为分析师的特色。

# architect.yaml
casual_prompt: |
  你是一位技术架构师。现在有个简单的问题需要你以自己的专业视角回应。
  请用轻松对话的方式回答，不需要写正式文档。保持你作为架构师的特色。

# writer.yaml
casual_prompt: |
  你是一位方案撰写专家。现在有个简单的问题需要你以自己的专业视角回应。
  请用轻松对话的方式回答，不需要写正式文档。保持你作为撰写专家的特色。
```

### 后端变更清单

**`workflow/engine.py`**：
- 新增 `_classify_input(self, requirement: str) -> bool` 方法
- 修改 `_run_brainstorm_workflow`：在执行前调用分类，SIMPLE 时走新分支
- 新增 `_run_casual_brainstorm` 方法：单轮并行所有 agent，使用 casual_prompt

**`agent/runner.py`**：
- `build_prompt` 支持可选的 `use_casual: bool = False` 参数，为 True 时使用 `casual_prompt` 且不附加 `output_template`

**`workflow/models.py`**：
- `PhaseStatus` 新增 SKIPPED
- `AgentDefinition` 新增 `casual_prompt` 字段

**`vault/agents/*.yaml`**：
- 三个 agent 文件各新增 `casual_prompt` 字段

### 错误处理

- 分类调用超时/失败 → 默认走完整的多轮流程
- 简单流程中某个 agent 失败 → 不影响其他 agent，记录错误

### 测试要点

- 分类逻辑：简单输入 → SIMPLE，复杂输入 → COMPLEX
- 简单流程：单轮并行执行、使用 casual_prompt、writer 不做汇总、phase 2 为 SKIPPED
- 降级：分类失败时走完整流程
- 模型验证：`PhaseStatus.SKIPPED` 和 `AgentDefinition.casual_prompt` 正确解析

### 不变的部分

- 前端无需修改（phase 2 显示 SKIPPED 状态由现有 UI 自然处理）
- default 模式完全不受影响
- 现有 API 接口不变
