# Brainstorm 令牌讨论工作流设计

## 背景

四个角色已从 analyst/architect/researcher/writer 更新为 analyst/architect/dev-lead/test-lead。需要调整两种工作流模式。

## 变更概览

| 模式 | 当前 | 变更后 |
|------|------|--------|
| Default | 4 阶段（阶段 2 误用 parallel） | 纯串行 4 阶段 |
| Brainstorm | 并行执行 + test-lead 整合 | 令牌传递讨论，4 角色全部参与 |

## Default 模式

保持 4 阶段纯串行，每阶段单 agent 顺序执行：

```
analyst → architect → dev-lead → test-lead
```

唯一变更：`_run_default_workflow` 中阶段 2 从 `_run_parallel_phase` 改为 `_run_phase`。

## Brainstorm 模式：令牌传递讨论

### 新增角色：Moderator（讨论主持人）

- 文件：`vault/agents/moderator.yaml`
- Model：`claude-haiku-4-5-20251001`
- 职责：阅读讨论上下文，通过 tool call `nominate_speaker` 指定下一个发言者
- 不产出正式文档，不参与前端可视化

### 令牌传递流程

```
1. 引擎启动轮次循环 (round 1..N，N 由用户指定，默认 1)
2. 每轮开始，重置 spoken_this_round = []
3. 启动 moderator 子进程，传入：
   - 原始需求
   - 所有已有 turns 记录
   - 本轮已发言列表
   - 当前轮次/总轮次
4. moderator 通过 tool call nominate_speaker(agent_id) 返回下一个发言者
5. 引擎校验 agent_id 有效且不在 spoken_this_round 中
6. 启动对应 agent 子进程，传入完整上下文（所有 turns）
7. 收集 agent 输出，追加到 turns
8. 将更新后的 turns 传回 moderator
9. 重复 4-8 直到 moderator 不再 nominate（本轮所有人都发过言）
10. 进入下一轮
```

### 数据模型

```python
class DiscussionTurn(BaseModel):
    round: int
    agent_id: str
    content: str

class DiscussionState(BaseModel):
    rounds_total: int
    current_round: int = 1
    spoken_this_round: list[str] = []
    turns: list[DiscussionTurn] = []
```

### Agent 发言执行

- 复用 `AgentRunner`，使用 `casual_prompt`（轻松对话风格）
- 不写 output_file，stdout 内容直接作为发言文本
- 上下文由引擎将所有 turns 格式化为 markdown 传入，不走 session_dir 的 .md 文件
- 讨论结束后，引擎合并所有 turns 为 `01-讨论记录.md` 写入 session_dir

### Moderator Tool

```
名称: nominate_speaker
参数: { "agent_id": "analyst" | "architect" | "dev-lead" | "test-lead" }
约束: 不能选择本轮已发言的角色；所有人都发言后不再调用
```

引擎通过 `--allowedTools` 限制 moderator 只能用此 tool，解析 stream-json 中的 tool_use 事件提取 agent_id。

### 简单输入处理

移除 `_classify_input` 和简单/复杂分支。brainstorm 模式统一走令牌讨论流程，不再区分。简单输入自然会在 1 轮内完成。

## 代码变更清单

### 新增文件

- `vault/agents/moderator.yaml` — moderator 角色定义

### 修改文件

**`backend/app/workflow/models.py`：**
- 新增 `DiscussionTurn`、`DiscussionState` 模型
- `Session.from_request` brainstorm 分支：单一讨论阶段，移除整合阶段
- `SessionConfig.rounds` 默认值 3 → 1

**`backend/app/workflow/engine.py`：**
- `_run_default_workflow`：阶段 2 改用 `_run_phase`
- `_run_brainstorm_workflow`：重写为令牌传递逻辑
- 新增 `_run_moderator_turn`：启动 moderator，解析 tool call
- 新增 `_run_agent_turn`：启动 agent，收集发言
- 移除 `_run_casual_brainstorm`
- 移除 `_classify_input`

### 不变文件

- `frontend/src/data/agentConfig.ts` — moderator 不需要前端配置
