# Brainstorm 令牌讨论工作流实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 brainstorm 模式从并行执行改为基于令牌传递的讨论工作流，由 moderator 角色协调 4 个 agent 的发言顺序。

**Architecture:** 新增 moderator（haiku 模型）通过 tool call `nominate_speaker` 选出下一个发言者，引擎循环执行 moderator → agent 直到每轮所有角色都发言完毕。Default 模式修复为纯串行。

**Tech Stack:** Python / Pydantic / asyncio / subprocess / Claude CLI stream-json

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `vault/agents/moderator.yaml` | Moderator 角色定义 |
| Modify | `backend/app/agent/parser.py` | StreamEvent 增加 tool_input 字段，解析 tool_use 的 input |
| Modify | `backend/app/workflow/models.py` | 新增 DiscussionTurn / DiscussionState，修改 from_request，rounds 默认值 |
| Modify | `backend/app/workflow/engine.py` | 重写 brainstorm 逻辑，新增 _run_moderator_turn / _run_agent_turn，移除 _classify_input / _run_casual_brainstorm，修复 default 阶段 2 |
| Modify | `backend/tests/test_parser.py` | 测试 tool_use input 解析 |
| Modify | `backend/tests/test_models.py` | 测试 DiscussionTurn / DiscussionState，更新 rounds 默认值测试，更新 from_request brainstorm 测试 |
| Modify | `backend/tests/test_workflow.py` | 重写 brainstorm 测试，修复 default 测试，移除 classify 测试 |

---

### Task 1: 扩展 StreamEvent 解析 tool_use input

**Files:**
- Modify: `backend/app/agent/parser.py:7-8,36-37`
- Test: `backend/tests/test_parser.py`

- [ ] **Step 1: 写失败测试 — tool_use 事件解析 input 字段**

在 `backend/tests/test_parser.py` 末尾追加：

```python
def test_parse_tool_use_captures_input():
    """Parse tool use event captures the input payload."""
    line = '{"type":"assistant","subtype":"tool_use","name":"nominate_speaker","input":{"agent_id":"architect"}}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "working"
    assert event.tool_name == "nominate_speaker"
    assert event.tool_input == {"agent_id": "architect"}


def test_parse_tool_use_without_input():
    """Tool use event without input defaults to empty dict."""
    line = '{"type":"assistant","subtype":"tool_use","name":"nominate_speaker"}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.tool_input == {}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/test_parser.py::test_parse_tool_use_captures_input tests/test_parser.py::test_parse_tool_use_without_input -v`
Expected: FAIL — `StreamEvent` 没有 `tool_input` 字段

- [ ] **Step 3: 实现 — StreamEvent 增加 tool_input 字段，解析时填充**

修改 `backend/app/agent/parser.py`：

```python
class StreamEvent(BaseModel):
    """Parsed event from Claude CLI stream-json output."""
    type: str  # thinking, working, output, completed, failed
    content: str | None = None
    tool_name: str | None = None
    tool_input: dict[str, Any] = {}
    error: str | None = None
    cost_usd: float | None = None
```

修改解析分支中 `subtype == "tool_use"` 部分：

```python
        elif subtype == "tool_use":
            return StreamEvent(type="working", tool_name=data.get("name"), tool_input=data.get("input", {}))
```

- [ ] **Step 4: 运行全部 parser 测试确认通过**

Run: `cd backend && uv run pytest tests/test_parser.py -v`
Expected: 全部 PASS（原有测试 + 新增 2 个）

- [ ] **Step 5: 提交**

```bash
git add backend/app/agent/parser.py backend/tests/test_parser.py
git commit -m "feat: parse tool_input from tool_use stream events"
```

---

### Task 2: 新增 DiscussionTurn / DiscussionState 数据模型

**Files:**
- Modify: `backend/app/workflow/models.py:55-84`
- Test: `backend/tests/test_models.py`

- [ ] **Step 1: 写失败测试 — DiscussionTurn 和 DiscussionState 模型**

在 `backend/tests/test_models.py` 末尾追加：

```python
from app.workflow.models import DiscussionTurn, DiscussionState


def test_discussion_turn():
    turn = DiscussionTurn(round=1, agent_id="analyst", content="我认为需求的核心是...")
    assert turn.round == 1
    assert turn.agent_id == "analyst"


def test_discussion_state_defaults():
    state = DiscussionState(rounds_total=3)
    assert state.current_round == 1
    assert state.spoken_this_round == []
    assert state.turns == []


def test_discussion_state_with_turns():
    state = DiscussionState(
        rounds_total=2,
        current_round=1,
        spoken_this_round=["analyst"],
        turns=[DiscussionTurn(round=1, agent_id="analyst", content="分析完成")],
    )
    assert len(state.turns) == 1
    assert "analyst" in state.spoken_this_round
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/test_models.py::test_discussion_turn tests/test_models.py::test_discussion_state_defaults tests/test_models.py::test_discussion_state_with_turns -v`
Expected: FAIL — ImportError

- [ ] **Step 3: 在 models.py 中添加模型**

在 `backend/app/workflow/models.py` 的 `AgentResult` 类之后追加：

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

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && uv run pytest tests/test_models.py -v`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add backend/app/workflow/models.py backend/tests/test_models.py
git commit -m "feat: add DiscussionTurn and DiscussionState models"
```

---

### Task 3: 修改 Session.from_request 和 SessionConfig 默认值

**Files:**
- Modify: `backend/app/workflow/models.py:30-31,67-78`
- Test: `backend/tests/test_models.py`

- [ ] **Step 1: 写失败测试 — brainstorm 阶段只有 1 个讨论阶段，rounds 默认 1**

在 `backend/tests/test_models.py` 末尾追加：

```python
def test_brainstorm_session_has_single_phase():
    """Brainstorm mode creates a single discussion phase with all 4 agents."""
    req = CreateSessionRequest(requirement="test", mode=SessionMode.BRAINSTORM)
    session = Session.from_request(req, "test-id")
    assert len(session.phases) == 1
    assert session.phases[0].name == "讨论"
    assert set(session.phases[0].agents) == {"analyst", "architect", "dev-lead", "test-lead"}


def test_rounds_default_is_one():
    """Default rounds config is 1, not 3."""
    req = CreateSessionRequest(requirement="test")
    assert req.config.rounds == 1
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/test_models.py::test_brainstorm_session_has_single_phase tests/test_models.py::test_rounds_default_is_one -v`
Expected: FAIL — 当前 brainstorm 有 2 个阶段，rounds 默认 3

- [ ] **Step 3: 实现 — 修改 from_request 和 SessionConfig**

修改 `backend/app/workflow/models.py`：

`SessionConfig.rounds` 默认值改为 1：
```python
class SessionConfig(BaseModel):
    rounds: int = 1
```

`Session.from_request` brainstorm 分支改为：
```python
        else:
            phases = [
                Phase(id=1, name="讨论", agents=["analyst", "architect", "dev-lead", "test-lead"]),
            ]
```

同时更新 `test_create_session_request_defaults` 测试（该测试断言 `rounds == 3`）：
```python
def test_create_session_request_defaults():
    req = CreateSessionRequest(requirement="设计一个电商系统")
    assert req.mode == SessionMode.DEFAULT
    assert req.agents is None
    assert req.config.rounds == 1
```

- [ ] **Step 4: 运行全部 models 测试确认通过**

Run: `cd backend && uv run pytest tests/test_models.py -v`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add backend/app/workflow/models.py backend/tests/test_models.py
git commit -m "feat: brainstorm single discussion phase, rounds default to 1"
```

---

### Task 4: 创建 moderator.yaml

**Files:**
- Create: `vault/agents/moderator.yaml`

- [ ] **Step 1: 创建 moderator 角色定义文件**

创建 `vault/agents/moderator.yaml`：

```yaml
name: "讨论主持人"
id: "moderator"
model: "claude-haiku-4-5-20251001"
max_turns: 1
system_prompt: |
  你是一场多人讨论的主持人。你的唯一职责是从本轮尚未发言的角色中选择下一个发言者。

  可选角色：analyst（需求分析师）、architect（方案架构师）、dev-lead（开发负责人）、test-lead（测试负责人）。

  规则：
  - 你必须调用 nominate_speaker 工具选择下一个发言者
  - 不能选择本轮已经发言过的角色
  - 如果所有角色都已发言，不要调用工具，直接结束

  请仅根据讨论内容的自然衔接选择最合适的发言者。
output_file: null
output_template: null
```

- [ ] **Step 2: 验证 YAML 可被 VaultManager 加载**

Run: `cd backend && uv run python -c "import yaml; data = yaml.safe_load(open('../vault/agents/moderator.yaml', encoding='utf-8')); print(data['id'], data['model'])"`
Expected: `moderator claude-haiku-4-5-20251001`

- [ ] **Step 3: 提交**

```bash
git add vault/agents/moderator.yaml
git commit -m "feat: add moderator agent definition for brainstorm token passing"
```

---

### Task 5: 修复 default 模式 — 阶段 2 改为串行

**Files:**
- Modify: `backend/app/workflow/engine.py:187-188`
- Test: `backend/tests/test_workflow.py`

- [ ] **Step 1: 写测试 — 验证 default 模式全部串行调用 _run_phase**

修改 `backend/tests/test_workflow.py` 中 `test_phase_2_runs_parallel`，改为验证串行：

```python
@pytest.mark.asyncio
async def test_default_all_phases_sequential(engine: WorkflowEngine):
    """Default workflow runs all 4 phases sequentially."""
    req = CreateSessionRequest(requirement="test")

    call_order = []

    async def track_submit(runner, task, event_callback=None):
        call_order.append(runner.agent_def.id)
        return AgentResult(
            agent_id=runner.agent_def.id, success=True,
            output_files=["out.md"], duration_ms=50,
        )

    engine.pool.submit = track_submit

    session = engine.create_session(req)
    await engine.execute_session(session)

    assert call_order == ["analyst", "architect", "dev-lead", "test-lead"]
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/test_workflow.py::test_default_all_phases_sequential -v`
Expected: 可能 PASS（当前阶段 2 虽然用 `_run_parallel_phase`，但只有 1 个 agent，行为等价串行）。但如果 PASS，此测试仍然有价值作为回归保护。继续修改代码确保正确性。

- [ ] **Step 3: 实现 — 阶段 2 改用 `_run_phase`**

修改 `backend/app/workflow/engine.py` 的 `_run_default_workflow` 方法，将阶段 2 从 `_run_parallel_phase` 改为 `_run_phase`：

```python
    async def _run_default_workflow(self, session: Session) -> None:
        """Run the default 4-phase workflow."""
        session_dir = self.vault_manager._sessions_path / session.id

        # Phase 1: analyst
        phase = session.phases[0]
        await self._run_phase(session, phase, "请分析以下需求并输出需求澄清文档。", session_dir)

        # Phase 2: architect
        phase = session.phases[1]
        await self._run_phase(session, phase, "请基于需求分析设计技术方案。", session_dir)

        # Phase 3: dev-lead
        phase = session.phases[2]
        await self._run_phase(session, phase, "请阅读所有前置文档，将技术方案分解为开发任务。", session_dir)

        # Phase 4: test-lead
        phase = session.phases[3]
        await self._run_phase(session, phase, "请阅读所有前置文档，制定测试计划。", session_dir)
```

- [ ] **Step 4: 运行 default 相关测试**

Run: `cd backend && uv run pytest tests/test_workflow.py::test_start_session_creates_and_runs tests/test_workflow.py::test_run_default_workflow_phases tests/test_workflow.py::test_default_all_phases_sequential -v`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add backend/app/workflow/engine.py backend/tests/test_workflow.py
git commit -m "fix: run default workflow phase 2 as sequential _run_phase"
```

---

### Task 6: 实现 _run_moderator_turn 方法

**Files:**
- Modify: `backend/app/workflow/engine.py`

- [ ] **Step 1: 在 engine.py 中添加 `_run_moderator_turn` 方法**

在 `engine.py` 的 `_run_phase` 方法之前添加：

```python
    async def _run_moderator_turn(
        self, session: Session, state: "DiscussionState", session_dir: Path,
    ) -> str | None:
        """Run moderator to select next speaker. Returns agent_id or None."""
        from app.workflow.models import DiscussionState as DS

        moderator_def = self._get_agent_def("moderator")

        turns_summary = ""
        if state.turns:
            turns_summary = "\n\n## 已有发言记录\n"
            for t in state.turns:
                turns_summary += f"\n### {t.agent_id}（第{t.round}轮）\n{t.content}\n"

        spoken_str = ", ".join(state.spoken_this_round) if state.spoken_this_round else "无"

        task = (
            f"## 讨论信息\n"
            f"当前第 {state.current_round}/{state.rounds_total} 轮\n"
            f"本轮已发言：{spoken_str}\n"
            f"原始需求：{session.input_requirement}\n"
            f"{turns_summary}\n\n"
            f"请选择下一个发言者。"
        )

        config = AgentRunConfig(
            work_dir=Path(f"{self.work_dir}/{session.id}/moderator"),
            session_dir=session_dir,
            input_files=[],
            api_key=self.api_key,
            api_base_url=self.api_base_url,
            allowed_tools=["nominate_speaker"],
        )
        runner = AgentRunner(moderator_def, config)

        try:
            await runner.prepare()
            events = await runner.execute(task)

            # Extract tool_use event with nominate_speaker
            for event in reversed(events):
                if (
                    event.type == "working"
                    and event.tool_name == "nominate_speaker"
                    and event.tool_input
                ):
                    agent_id = event.tool_input.get("agent_id")
                    if agent_id and agent_id not in state.spoken_this_round:
                        return agent_id

            return None
        finally:
            await runner.cleanup()
```

注意：这里需要在文件顶部 import 中确认 `AgentRunner` 和 `AgentRunConfig` 已导入（它们已经在文件顶部）。

- [ ] **Step 2: 暂不单独提交，与 Task 7 一起测试后提交**

---

### Task 7: 实现 _run_agent_turn 和重写 _run_brainstorm_workflow

**Files:**
- Modify: `backend/app/workflow/engine.py`

- [ ] **Step 1: 添加 `_run_agent_turn` 方法**

在 `_run_moderator_turn` 之后添加：

```python
    async def _run_agent_turn(
        self, session: Session, state: "DiscussionState",
        agent_id: str, session_dir: Path,
    ) -> str:
        """Run a single agent turn and return the spoken content."""
        agent_def = self._get_agent_def(agent_id)

        turns_summary = ""
        if state.turns:
            turns_summary = "\n\n## 已有发言记录\n"
            for t in state.turns:
                turns_summary += f"\n### {t.agent_id}（第{t.round}轮）\n{t.content}\n"

        task = (
            f"## 讨论主题\n{session.input_requirement}\n"
            f"{turns_summary}\n\n"
            f"请以你的角色身份发表观点。"
        )

        config = AgentRunConfig(
            work_dir=Path(f"{self.work_dir}/{session.id}/{agent_id}"),
            session_dir=session_dir,
            input_files=[],
            api_key=self.api_key,
            api_base_url=self.api_base_url,
            allowed_tools=self.allowed_tools,
            use_casual=True,
        )
        runner = AgentRunner(agent_def, config)

        try:
            await runner.prepare()
            events = await runner.execute(task)

            # Extract final text content
            final = next(
                (e for e in reversed(events) if e.type == "completed" and e.content),
                None,
            )
            return final.content if final else ""
        finally:
            await runner.cleanup()
```

- [ ] **Step 2: 重写 `_run_brainstorm_workflow`**

替换 `_run_brainstorm_workflow` 方法为：

```python
    async def _run_brainstorm_workflow(self, session: Session) -> None:
        """Run brainstorm mode with token-passing discussion."""
        from app.workflow.models import DiscussionState, DiscussionTurn

        session_dir = self.vault_manager._sessions_path / session.id
        phase = session.phases[0]
        phase.status = PhaseStatus.RUNNING
        phase.started_at = datetime.now()
        self.vault_manager.update_session(session)
        await self.ws_manager.emit(session.id, "phase:started", phase=phase.id)

        state = DiscussionState(rounds_total=session.config_rounds if hasattr(session, "config_rounds") else 1)

        for round_num in range(1, state.rounds_total + 1):
            state.current_round = round_num
            state.spoken_this_round = []

            while True:
                next_agent = await self._run_moderator_turn(session, state, session_dir)
                if next_agent is None:
                    break

                content = await self._run_agent_turn(session, state, next_agent, session_dir)
                turn = DiscussionTurn(round=round_num, agent_id=next_agent, content=content)
                state.turns.append(turn)
                state.spoken_this_round.append(next_agent)

        # Write combined discussion log to session dir
        log_path = session_dir / "01-讨论记录.md"
        lines = [f"# 讨论记录\n\n## 原始需求\n{session.input_requirement}\n"]
        for t in state.turns:
            lines.append(f"\n## {t.agent_id}（第{t.round}轮）\n\n{t.content}\n")
        log_path.write_text("\n".join(lines), encoding="utf-8")

        added = self._add_outputs(phase, ["01-讨论记录.md"])
        phase.status = PhaseStatus.COMPLETED
        phase.completed_at = datetime.now()
        self.vault_manager.update_session(session)
        await self.ws_manager.emit(session.id, "phase:completed", phase=phase.id, outputs=added)
```

等等 — `Session` 模型当前没有 `config_rounds` 字段。需要从 `CreateSessionRequest.config.rounds` 传递到 Session。在 `Session.from_request` 中保存：

在 `Session` 模型中增加字段：
```python
    config_rounds: int = 1
```

在 `Session.from_request` 中赋值：
```python
        return cls(
            id=session_id,
            mode=req.mode,
            input_requirement=req.requirement,
            phases=phases,
            config_rounds=req.config.rounds,
        )
```

- [ ] **Step 3: 移除 `_classify_input` 和 `_run_casual_brainstorm` 方法**

从 `engine.py` 中删除：
- `_classify_input` 方法（第 53-129 行）
- `_run_casual_brainstorm` 方法（第 233-274 行）

- [ ] **Step 4: 写 brainstorm 令牌测试**

替换 `backend/tests/test_workflow.py` 中的所有 brainstorm 相关测试（`test_classify_input_*`、`test_brainstorm_simple_input_*`、`test_brainstorm_complex_input_*`）为：

```python
@pytest.mark.asyncio
async def test_brainstorm_token_passing_flow(engine: WorkflowEngine):
    """Brainstorm mode uses token-passing: moderator selects speakers."""
    req = CreateSessionRequest(
        requirement="讨论主题",
        mode=SessionMode.BRAINSTORM,
        config={"rounds": 1},
    )

    # Track which agents were asked to speak
    submitted_agents = []

    async def mock_submit(runner, task, event_callback=None):
        submitted_agents.append(runner.agent_def.id)
        return AgentResult(
            agent_id=runner.agent_def.id, success=True,
            output_files=["out.md"], duration_ms=100,
        )

    engine.pool.submit = mock_submit

    # Mock _run_moderator_turn to cycle through agents
    call_count = 0

    async def mock_moderator(session, state, session_dir):
        nonlocal call_count
        agents = ["analyst", "architect", "dev-lead", "test-lead"]
        if call_count < len(agents):
            agent_id = agents[call_count]
            call_count += 1
            return agent_id
        return None

    engine._run_moderator_turn = mock_moderator

    # Mock _run_agent_turn to return content
    async def mock_agent_turn(session, state, agent_id, session_dir):
        return f"{agent_id} says something"

    engine._run_agent_turn = mock_agent_turn

    session = engine.create_session(req)
    await engine.execute_session(session)

    assert session.status == SessionStatus.COMPLETED
    assert len(session.phases) == 1
    assert session.phases[0].status == PhaseStatus.COMPLETED


@pytest.mark.asyncio
async def test_brainstorm_skips_spoken_agents(engine: WorkflowEngine):
    """Moderator will not re-select already-spoken agents."""
    req = CreateSessionRequest(
        requirement="test",
        mode=SessionMode.BRAINSTORM,
        config={"rounds": 1},
    )

    async def mock_moderator(session, state, session_dir):
        # First call: pick analyst. After that return None.
        if "analyst" not in state.spoken_this_round:
            return "analyst"
        return None

    engine._run_moderator_turn = mock_moderator

    async def mock_agent_turn(session, state, agent_id, session_dir):
        return f"{agent_id} content"

    engine._run_agent_turn = mock_agent_turn

    session = engine.create_session(req)
    await engine.execute_session(session)

    assert session.status == SessionStatus.COMPLETED
    # Only 1 turn (analyst)
    from app.workflow.models import DiscussionState
    assert len(session.phases[0].outputs) == 1


@pytest.mark.asyncio
async def test_brainstorm_writes_discussion_log(engine: WorkflowEngine):
    """Brainstorm writes 01-讨论记录.md to session dir."""
    req = CreateSessionRequest(
        requirement="test topic",
        mode=SessionMode.BRAINSTORM,
        config={"rounds": 1},
    )

    async def mock_moderator(session, state, session_dir):
        if not state.spoken_this_round:
            return "analyst"
        return None

    engine._run_moderator_turn = mock_moderator

    async def mock_agent_turn(session, state, agent_id, session_dir):
        return "analyst said hello"

    engine._run_agent_turn = mock_agent_turn

    session = engine.create_session(req)
    await engine.execute_session(session)

    session_dir = engine.vault_manager._sessions_path / session.id
    log_file = session_dir / "01-讨论记录.md"
    assert log_file.exists()
    content = log_file.read_text(encoding="utf-8")
    assert "analyst" in content
    assert "analyst said hello" in content
```

- [ ] **Step 5: 运行全部 workflow 测试**

Run: `cd backend && uv run pytest tests/test_workflow.py -v`
Expected: 全部 PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/workflow/models.py backend/app/workflow/engine.py backend/tests/test_workflow.py
git commit -m "feat: implement brainstorm token-passing workflow with moderator"
```

---

### Task 8: 添加 _run_moderator_turn 单元测试

**Files:**
- Modify: `backend/tests/test_workflow.py`

- [ ] **Step 1: 写测试 — moderator 提取 tool call 结果**

在 `backend/tests/test_workflow.py` 末尾追加：

```python
@pytest.mark.asyncio
async def test_moderator_turn_extracts_tool_call(engine: WorkflowEngine):
    """_run_moderator_turn parses nominate_speaker tool call from stream events."""
    from app.workflow.models import DiscussionState

    req = CreateSessionRequest(requirement="test", mode=SessionMode.BRAINSTORM)
    session = engine.create_session(req)
    session_dir = engine.vault_manager._sessions_path / session.id
    session_dir.mkdir(parents=True, exist_ok=True)

    state = DiscussionState(rounds_total=1)

    with patch("app.agent.runner.AgentRunner.execute") as mock_execute:
        from app.agent.parser import StreamEvent
        mock_execute.return_value = [
            StreamEvent(type="thinking", content="选择发言者..."),
            StreamEvent(
                type="working",
                tool_name="nominate_speaker",
                tool_input={"agent_id": "architect"},
            ),
            StreamEvent(type="completed", content="选择 architect", cost_usd=0.001),
        ]

        result = await engine._run_moderator_turn(session, state, session_dir)
        assert result == "architect"


@pytest.mark.asyncio
async def test_moderator_turn_returns_none_when_no_tool_call(engine: WorkflowEngine):
    """_run_moderator_turn returns None when moderator doesn't call tool."""
    from app.workflow.models import DiscussionState

    req = CreateSessionRequest(requirement="test", mode=SessionMode.BRAINSTORM)
    session = engine.create_session(req)
    session_dir = engine.vault_manager._sessions_path / session.id
    session_dir.mkdir(parents=True, exist_ok=True)

    state = DiscussionState(rounds_total=1, spoken_this_round=["analyst", "architect", "dev-lead", "test-lead"])

    with patch("app.agent.runner.AgentRunner.execute") as mock_execute:
        from app.agent.parser import StreamEvent
        mock_execute.return_value = [
            StreamEvent(type="completed", content="所有人都已发言", cost_usd=0.001),
        ]

        result = await engine._run_moderator_turn(session, state, session_dir)
        assert result is None
```

- [ ] **Step 2: 运行测试**

Run: `cd backend && uv run pytest tests/test_workflow.py::test_moderator_turn_extracts_tool_call tests/test_workflow.py::test_moderator_turn_returns_none_when_no_tool_call -v`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add backend/tests/test_workflow.py
git commit -m "test: add moderator turn unit tests"
```

---

### Task 9: 运行全部测试 + 最终验证

- [ ] **Step 1: 运行后端全部测试**

Run: `cd backend && uv run pytest -v`
Expected: 全部 PASS

- [ ] **Step 2: 检查无遗留死代码**

确认 `engine.py` 中不再包含 `_classify_input` 和 `_run_casual_brainstorm` 方法。

Run: `cd backend && grep -n "_classify_input\|_run_casual_brainstorm" app/workflow/engine.py`
Expected: 无输出

- [ ] **Step 3: 最终提交（如有格式修复）**

```bash
git add -A
git commit -m "chore: clean up after brainstorm token workflow implementation"
```

---

## Self-Review

**Spec coverage check:**
- Default 纯串行 → Task 5 ✓
- Moderator 角色 (haiku, tool call) → Task 4 + Task 6 ✓
- DiscussionTurn / DiscussionState → Task 2 ✓
- 令牌传递流程 → Task 7 ✓
- Agent casual_prompt 发言 → Task 7 (_run_agent_turn with use_casual=True) ✓
- 讨论记录写入 → Task 7 (01-讨论记录.md) ✓
- 移除 _classify_input / _run_casual_brainstorm → Task 7 Step 3 ✓
- StreamEvent 解析 tool_input → Task 1 ✓
- rounds 默认 1 → Task 3 ✓

**Placeholder scan:** No TBD/TODO found. All steps contain complete code.

**Type consistency:** `DiscussionState` and `DiscussionTurn` are defined in Task 2 and consistently referenced in Tasks 6, 7, 8. `StreamEvent.tool_input` added in Task 1 and used in Task 6.
