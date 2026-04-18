# Brainstorm Casual Response Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add input classification to brainstorm mode so simple/casual inputs get lightweight single-round responses from all agents, while complex inputs still run the full multi-round discussion workflow.

**Architecture:** A new `_classify_input` method uses claude CLI (haiku model) to determine if the input is simple or complex. The `_run_brainstorm_workflow` method branches: simple inputs run all agents in a single parallel round using `casual_prompt`, then skip the writer synthesis phase; complex inputs run the existing multi-round flow unchanged.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, claude CLI subprocess, PyYAML, pytest + pytest-asyncio

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/app/workflow/models.py` | Modify | Add `PhaseStatus.SKIPPED`, `AgentDefinition.casual_prompt` |
| `backend/app/agent/runner.py` | Modify | `AgentRunConfig.use_casual`, `build_prompt` supports `use_casual` flag, `execute` reads config flag |
| `backend/app/workflow/engine.py` | Modify | Add `_classify_input`, `_run_casual_brainstorm`; modify `_run_brainstorm_workflow` |
| `vault/agents/analyst.yaml` | Modify | Add `casual_prompt` field |
| `vault/agents/architect.yaml` | Modify | Add `casual_prompt` field |
| `vault/agents/writer.yaml` | Modify | Add `casual_prompt` field |
| `backend/tests/test_models.py` | Modify | Test new enum value and model field |
| `backend/tests/test_runner_casual.py` | Create | Test `build_prompt` casual mode |
| `backend/tests/test_workflow.py` | Modify | Test classification branching, casual flow, skip behavior |

---

### Task 1: Add PhaseStatus.SKIPPED and AgentDefinition.casual_prompt to models

**Files:**
- Modify: `backend/app/workflow/models.py:23` (PhaseStatus enum)
- Modify: `backend/app/workflow/models.py:85-93` (AgentDefinition model)
- Test: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_models.py`:

```python
def test_phase_status_skipped():
    assert PhaseStatus.SKIPPED == "skipped"


def test_agent_definition_casual_prompt_default():
    data = {
        "name": "需求分析师",
        "id": "analyst",
        "system_prompt": "You are an analyst.",
    }
    agent = AgentDefinition(**data)
    assert agent.casual_prompt is None


def test_agent_definition_with_casual_prompt():
    data = {
        "name": "需求分析师",
        "id": "analyst",
        "system_prompt": "You are an analyst.",
        "casual_prompt": "轻松回应即可。",
    }
    agent = AgentDefinition(**data)
    assert agent.casual_prompt == "轻松回应即可。"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_models.py::test_phase_status_skipped tests/test_models.py::test_agent_definition_casual_prompt_default tests/test_models.py::test_agent_definition_with_casual_prompt -v`
Expected: FAIL — `PhaseStatus` has no `SKIPPED`, `AgentDefinition` has no `casual_prompt`

- [ ] **Step 3: Write minimal implementation**

In `backend/app/workflow/models.py`, add `SKIPPED` to `PhaseStatus` enum:

```python
class PhaseStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
```

Add `casual_prompt` field to `AgentDefinition` (after `output_template`):

```python
class AgentDefinition(BaseModel):
    name: str
    id: str
    model: str = "claude-sonnet-4-20250514"
    max_turns: int = 20
    system_prompt: str
    output_file: str | None = None
    output_template: str | None = None
    casual_prompt: str | None = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_models.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/workflow/models.py backend/tests/test_models.py
git commit -m "feat: add PhaseStatus.SKIPPED and AgentDefinition.casual_prompt"
```

---

### Task 2: Update AgentRunner to support casual mode

**Files:**
- Modify: `backend/app/agent/runner.py` (AgentRunConfig, build_prompt, execute)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_runner_casual.py`:

```python
from pathlib import Path

from app.agent.runner import AgentRunner, AgentRunConfig
from app.workflow.models import AgentDefinition


def test_build_prompt_casual_uses_casual_prompt():
    agent_def = AgentDefinition(
        name="需求分析师",
        id="analyst",
        system_prompt="正式 system prompt",
        casual_prompt="轻松回应即可。",
        output_template="## 模板",
    )
    config = AgentRunConfig(
        work_dir=Path("/tmp/test"),
        session_dir=Path("/tmp/test-session"),
        use_casual=True,
    )
    runner = AgentRunner(agent_def, config)
    prompt = runner.build_prompt("你好")
    assert "轻松回应即可。" in prompt
    assert "正式 system prompt" not in prompt
    assert "模板" not in prompt


def test_build_prompt_default_uses_system_prompt():
    agent_def = AgentDefinition(
        name="需求分析师",
        id="analyst",
        system_prompt="正式 system prompt",
        output_template="## 模板",
    )
    config = AgentRunConfig(
        work_dir=Path("/tmp/test"),
        session_dir=Path("/tmp/test-session"),
    )
    runner = AgentRunner(agent_def, config)
    prompt = runner.build_prompt("分析需求")
    assert "正式 system prompt" in prompt
    assert "模板" in prompt


def test_build_prompt_casual_without_casual_prompt_falls_back():
    agent_def = AgentDefinition(
        name="需求分析师",
        id="analyst",
        system_prompt="正式 system prompt",
        output_template="## 模板",
    )
    config = AgentRunConfig(
        work_dir=Path("/tmp/test"),
        session_dir=Path("/tmp/test-session"),
        use_casual=True,
    )
    runner = AgentRunner(agent_def, config)
    prompt = runner.build_prompt("你好")
    # Falls back to system_prompt when casual_prompt is None
    assert "正式 system prompt" in prompt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_runner_casual.py -v`
Expected: FAIL — `AgentRunConfig` has no `use_casual` field, `build_prompt` does not read it

- [ ] **Step 3: Write minimal implementation**

In `backend/app/agent/runner.py`, add `use_casual` to `AgentRunConfig`:

```python
class AgentRunConfig(BaseModel):
    """Configuration for a single agent run."""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    work_dir: Path
    session_dir: Path
    input_files: list[Path] = []
    timeout_seconds: int = 300
    api_key: str = ""
    api_base_url: str = ""
    allowed_tools: list[str] = []
    use_casual: bool = False
```

Replace `build_prompt` method:

```python
    def build_prompt(self, task: str) -> str:
        """Build the full prompt for claude -p."""
        if self.config.use_casual and self.agent_def.casual_prompt:
            parts = [self.agent_def.casual_prompt]
        else:
            parts = [self.agent_def.system_prompt]
            if self.agent_def.output_template:
                parts.append(
                    f"\n\n输出格式参考:\n{self.agent_def.output_template}"
                )
        parts.append(f"\n\n## 任务\n{task}")
        return "".join(parts)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_runner_casual.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/runner.py backend/tests/test_runner_casual.py
git commit -m "feat: AgentRunner supports casual mode via AgentRunConfig.use_casual"
```

---

### Task 3: Add casual_prompt to agent YAML files

**Files:**
- Modify: `vault/agents/analyst.yaml`
- Modify: `vault/agents/architect.yaml`
- Modify: `vault/agents/writer.yaml`

- [ ] **Step 1: Add casual_prompt to each YAML file**

Append to `vault/agents/analyst.yaml` (after the `output_template` block):

```yaml
casual_prompt: |
  你是一位需求分析师。现在有个简单的问题需要你以自己的专业视角回应。
  请用轻松对话的方式回答，不需要写正式文档。保持你作为分析师的特色——关注需求本质、用户意图和关键问题。
```

Append to `vault/agents/architect.yaml` (after the `output_template` block):

```yaml
casual_prompt: |
  你是一位技术架构师。现在有个简单的问题需要你以自己的专业视角回应。
  请用轻松对话的方式回答，不需要写正式文档。保持你作为架构师的特色——关注技术可行性、系统设计和最佳实践。
```

Append to `vault/agents/writer.yaml` (after the `output_template` block):

```yaml
casual_prompt: |
  你是一位方案撰写专家。现在有个简单的问题需要你以自己的专业视角回应。
  请用轻松对话的方式回答，不需要写正式文档。保持你作为撰写专家的特色——关注表达清晰、逻辑严谨和信息完整。
```

- [ ] **Step 2: Verify YAML loads correctly**

Run: `cd backend && uv run python -c "from app.workflow.models import AgentDefinition; import yaml; [print(AgentDefinition(**yaml.safe_load(open(f'../vault/agents/{f}', encoding='utf-8'))).casual_prompt[:20]) for f in ['analyst.yaml','architect.yaml','writer.yaml']]"`
Expected: Prints first 20 chars of each casual_prompt, no errors

- [ ] **Step 3: Commit**

```bash
git add vault/agents/analyst.yaml vault/agents/architect.yaml vault/agents/writer.yaml
git commit -m "feat: add casual_prompt to agent YAML definitions"
```

---

### Task 4: Add _classify_input method to WorkflowEngine

**Files:**
- Modify: `backend/app/workflow/engine.py` (add new method after `_load_agent_defs`)
- Test: `backend/tests/test_workflow.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_workflow.py`:

```python
import subprocess
from unittest.mock import patch, MagicMock


@pytest.mark.asyncio
async def test_classify_input_returns_true_for_complex(engine: WorkflowEngine):
    """Complex input is classified as needing full workflow."""
    with patch("app.workflow.engine.subprocess.Popen") as mock_popen:
        proc = MagicMock()
        proc.communicate.return_value = (b'{"type":"result","subtype":"success","result":"COMPLEX"}', b"")
        proc.returncode = 0
        mock_popen.return_value = proc
        result = await engine._classify_input("设计一个电商系统，需要支持多商户和支付功能")
        assert result is True


@pytest.mark.asyncio
async def test_classify_input_returns_false_for_simple(engine: WorkflowEngine):
    """Simple input is classified as not needing full workflow."""
    with patch("app.workflow.engine.subprocess.Popen") as mock_popen:
        proc = MagicMock()
        proc.communicate.return_value = (b'{"type":"result","subtype":"success","result":"SIMPLE"}', b"")
        proc.returncode = 0
        mock_popen.return_value = proc
        result = await engine._classify_input("你好")
        assert result is False


@pytest.mark.asyncio
async def test_classify_input_defaults_to_complex_on_error(engine: WorkflowEngine):
    """Classification failure defaults to complex (full workflow)."""
    with patch("app.workflow.engine.subprocess.Popen") as mock_popen:
        mock_popen.side_effect = Exception("claude CLI not found")
        result = await engine._classify_input("你好")
        assert result is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_workflow.py::test_classify_input_returns_true_for_complex tests/test_workflow.py::test_classify_input_returns_false_for_simple tests/test_workflow.py::test_classify_input_defaults_to_complex_on_error -v`
Expected: FAIL — `WorkflowEngine` has no `_classify_input` method

- [ ] **Step 3: Write minimal implementation**

Add to `backend/app/workflow/engine.py`, after `_load_agent_defs` (after line 51). Note: `subprocess` is already imported at the top of the file; `json` is not, so import it locally:

```python
    async def _classify_input(self, requirement: str) -> bool:
        """Classify input as complex (True) or simple (False).

        Uses claude CLI with haiku model for fast, cheap classification.
        Defaults to True (complex) on any failure.
        """
        import json
        import os
        import sys

        claude_cmd = "claude.cmd" if sys.platform == "win32" else "claude"
        classify_prompt = (
            "判断以下输入是否需要深入分析和多轮讨论。"
            "如果只是打招呼、简单提问、闲聊，回复 SIMPLE。"
            "如果是复杂需求、技术方案、需要分析的议题，回复 COMPLEX。"
            f"\n\n输入：{requirement}"
        )
        cmd = [
            claude_cmd, "-p", "-",
            "--output-format", "stream-json",
            "--model", "claude-haiku-4-5-20251001",
            "--max-turns", "1",
        ]
        env = dict(os.environ)
        if self.api_key:
            env["ANTHROPIC_API_KEY"] = self.api_key
        if self.api_base_url:
            env["ANTHROPIC_BASE_URL"] = self.api_base_url

        loop = asyncio.get_event_loop()

        def _run():
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE,
                env=env,
            )
            stdout, stderr = proc.communicate(
                input=classify_prompt.encode("utf-8"), timeout=10,
            )
            return stdout.decode("utf-8", errors="replace")

        try:
            stdout = await loop.run_in_executor(None, _run)
            for line in stdout.strip().splitlines():
                try:
                    data = json.loads(line.strip())
                    if data.get("type") == "result" and data.get("subtype") == "success":
                        result_text = (data.get("result") or "").strip().upper()
                        if "SIMPLE" in result_text:
                            return False
                        if "COMPLEX" in result_text:
                            return True
                except (json.JSONDecodeError, KeyError):
                    continue
            return True  # default to complex if no clear answer
        except Exception:
            import logging
            logging.getLogger(__name__).warning("Input classification failed, defaulting to complex")
            return True
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_workflow.py::test_classify_input_returns_true_for_complex tests/test_workflow.py::test_classify_input_returns_false_for_simple tests/test_workflow.py::test_classify_input_defaults_to_complex_on_error -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/workflow/engine.py backend/tests/test_workflow.py
git commit -m "feat: add _classify_input method to WorkflowEngine"
```

---

### Task 5: Add _run_casual_brainstorm and modify _run_brainstorm_workflow

**Files:**
- Modify: `backend/app/workflow/engine.py` (replace `_run_brainstorm_workflow`, add `_run_casual_brainstorm`)
- Test: `backend/tests/test_workflow.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_workflow.py`:

```python
@pytest.mark.asyncio
async def test_brainstorm_simple_input_runs_casual_flow(engine: WorkflowEngine):
    """Simple input triggers casual flow: all agents in one round, phase 2 skipped."""
    req = CreateSessionRequest(requirement="你好", mode=SessionMode.BRAINSTORM)

    configs_seen = []

    async def capture_submit(runner, task, event_callback=None):
        configs_seen.append(runner.config.use_casual)
        return AgentResult(
            agent_id=runner.agent_def.id, success=True,
            output_files=["out.md"], duration_ms=100,
        )

    engine.pool.submit = capture_submit

    session = engine.create_session(req)

    with patch.object(engine, "_classify_input", return_value=False):
        await engine.execute_session(session)

    assert session.status == SessionStatus.COMPLETED
    assert session.phases[0].status == PhaseStatus.COMPLETED
    assert session.phases[1].status == PhaseStatus.SKIPPED
    # All agents in phase 1 were run
    assert engine.pool.submit.call_count == len(session.phases[0].agents)
    # All runners had use_casual=True
    assert all(c is True for c in configs_seen)


@pytest.mark.asyncio
async def test_brainstorm_complex_input_runs_full_flow(engine: WorkflowEngine):
    """Complex input triggers full multi-round brainstorm flow."""
    req = CreateSessionRequest(requirement="设计电商系统", mode=SessionMode.BRAINSTORM)

    engine.pool.submit = AsyncMock(return_value=AgentResult(
        agent_id="agent", success=True, output_files=["out.md"], duration_ms=100,
    ))

    session = engine.create_session(req)

    with patch.object(engine, "_classify_input", return_value=True):
        await engine.execute_session(session)

    assert session.status == SessionStatus.COMPLETED
    assert session.phases[0].status == PhaseStatus.COMPLETED
    assert session.phases[1].status == PhaseStatus.COMPLETED
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_workflow.py::test_brainstorm_simple_input_runs_casual_flow tests/test_workflow.py::test_brainstorm_complex_input_runs_full_flow -v`
Expected: FAIL — `_run_brainstorm_workflow` does not call `_classify_input` or branch

- [ ] **Step 3: Write minimal implementation**

First, add `_run_casual_brainstorm` method to `WorkflowEngine` in `backend/app/workflow/engine.py`, after the existing `_run_brainstorm_workflow` method:

```python
    async def _run_casual_brainstorm(self, session: Session, phase: Any, session_dir: Path) -> None:
        """Run casual single-round brainstorm for simple inputs."""
        phase.status = PhaseStatus.RUNNING
        phase.started_at = datetime.now()
        self.vault_manager.update_session(session)
        await self.ws_manager.emit(session.id, "phase:started", phase=phase.id)

        task = f"请以你的角色身份直接回应以下内容：\n\n{session.input_requirement}"

        async def run_single(agent_id: str) -> AgentResult:
            agent_def = self._get_agent_def(agent_id)
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
            return await self.pool.submit(runner, task)

        results = await asyncio.gather(
            *[run_single(aid) for aid in phase.agents],
            return_exceptions=True,
        )

        added: list[str] = []
        success_count = 0
        for r in results:
            if isinstance(r, AgentResult):
                added.extend(self._add_outputs(phase, r.output_files))
                if r.success:
                    success_count += 1

        phase.status = PhaseStatus.COMPLETED if success_count > 0 else PhaseStatus.FAILED
        phase.completed_at = datetime.now()
        self.vault_manager.update_session(session)
        await self.ws_manager.emit(
            session.id, "phase:completed", phase=phase.id, outputs=added,
        )
```

Then, replace the existing `_run_brainstorm_workflow` method with:

```python
    async def _run_brainstorm_workflow(self, session: Session) -> None:
        """Run brainstorm mode with input classification."""
        session_dir = self.vault_manager._sessions_path / session.id

        is_complex = await self._classify_input(session.input_requirement)

        if not is_complex:
            # Simple input: single-round casual response from all agents
            phase = session.phases[0]
            await self._run_casual_brainstorm(session, phase, session_dir)

            # Skip phase 2 (writer synthesis)
            if len(session.phases) > 1:
                session.phases[1].status = PhaseStatus.SKIPPED
                self.vault_manager.update_session(session)
        else:
            # Complex input: full multi-round brainstorm
            rounds = 3
            phase = session.phases[0]
            for round_num in range(1, rounds + 1):
                await self._run_parallel_phase(
                    session, phase, session_dir,
                    task_prefix=f"第 {round_num}/{rounds} 轮讨论。请基于已有信息提出你的观点。",
                )

            # Final synthesis
            phase = session.phases[1]
            await self._run_phase(
                session, phase,
                "请阅读所有讨论内容，汇总输出综合报告。",
                session_dir,
            )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_workflow.py::test_brainstorm_simple_input_runs_casual_flow tests/test_workflow.py::test_brainstorm_complex_input_runs_full_flow -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/workflow/engine.py backend/tests/test_workflow.py
git commit -m "feat: add casual brainstorm flow with input classification"
```

---

### Task 6: Run full test suite and verify no regressions

**Files:** None (verification only)

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && uv run pytest -v`
Expected: All tests PASS, no regressions

- [ ] **Step 2: Run frontend test suite (unchanged, verify no breakage)**

Run: `cd frontend && npm run test`
Expected: All tests PASS

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address test regressions from brainstorm casual response feature"
```
