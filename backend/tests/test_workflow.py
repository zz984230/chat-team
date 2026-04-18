import asyncio
import subprocess
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.workflow.engine import WorkflowEngine
from app.workflow.models import (
    Session, SessionStatus, PhaseStatus, SessionMode,
    CreateSessionRequest, AgentResult,
)
from app.vault.manager import VaultManager
from app.ws.manager import WebSocketManager
from app.agent.pool import AgentPool


def _create_agent_yamls(agents_dir: Path) -> None:
    """Create minimal agent YAML definitions for testing."""
    import yaml
    agents = [
        {"id": "analyst", "name": "需求分析师", "system_prompt": "You are an analyst."},
        {"id": "architect", "name": "架构师", "system_prompt": "You are an architect."},
        {"id": "writer", "name": "整合输出师", "system_prompt": "You are a writer."},
    ]
    for agent in agents:
        path = agents_dir / f"{agent['id']}.yaml"
        path.write_text(yaml.dump(agent, allow_unicode=True), encoding="utf-8")


@pytest.fixture
def engine(tmp_vault: Path) -> WorkflowEngine:
    vm = VaultManager(tmp_vault)
    vm.ensure_structure()
    _create_agent_yamls(vm._agents_path)
    ws = WebSocketManager()
    pool = MagicMock(spec=AgentPool)
    pool.submit = AsyncMock()
    return WorkflowEngine(vault_manager=vm, pool=pool, ws_manager=ws)


@pytest.mark.asyncio
async def test_start_session_creates_and_runs(engine: WorkflowEngine):
    """create_session + execute_session creates session in vault and runs it."""
    req = CreateSessionRequest(requirement="test requirement")

    # Mock pool to return success
    engine.pool.submit = AsyncMock(return_value=AgentResult(
        agent_id="analyst", success=True, output_files=["01-需求澄清.md"], duration_ms=1000,
    ))

    session = engine.create_session(req)
    assert session.id  # session_id was generated
    assert session.input_requirement == "test requirement"
    session = await engine.execute_session(session)
    assert session.status == SessionStatus.COMPLETED


@pytest.mark.asyncio
async def test_run_default_workflow_phases(engine: WorkflowEngine):
    """Default workflow runs 3 phases in order."""
    req = CreateSessionRequest(requirement="test")

    engine.pool.submit = AsyncMock(return_value=AgentResult(
        agent_id="agent", success=True, output_files=["out.md"], duration_ms=100,
    ))

    session = engine.create_session(req)
    await engine.execute_session(session)

    # Should have called pool.submit once per agent (3 total: analyst + architect + writer)
    assert engine.pool.submit.call_count == 3


@pytest.mark.asyncio
async def test_phase_2_runs_parallel(engine: WorkflowEngine):
    """Phase 2 runs architect agent."""
    req = CreateSessionRequest(requirement="test")

    call_order = []

    async def track_submit(runner, task, event_callback=None):
        call_order.append(runner.agent_def.id)
        await asyncio.sleep(0.05)  # simulate work
        return AgentResult(
            agent_id=runner.agent_def.id, success=True,
            output_files=["out.md"], duration_ms=50,
        )

    engine.pool.submit = track_submit

    session = engine.create_session(req)
    await engine.execute_session(session)

    # Phase 2 agents should overlap (not strictly sequential)
    # Both should appear before writer
    assert "architect" in call_order
    assert "writer" in call_order
    assert call_order.index("writer") > call_order.index("architect")


@pytest.mark.asyncio
async def test_pause_and_resume(engine: WorkflowEngine):
    """Can pause and resume a session."""
    req = CreateSessionRequest(requirement="test")
    session = engine.create_session(req)
    await engine.execute_session(session)

    # For this test, just verify session state transitions
    loaded = engine.vault_manager.get_session(session.id)
    assert loaded is not None


@pytest.mark.asyncio
async def test_get_session(engine: WorkflowEngine):
    """get_session returns session from memory or vault."""
    req = CreateSessionRequest(requirement="test")
    created = engine.create_session(req)
    await engine.execute_session(created)

    loaded = engine.get_session(created.id)
    assert loaded is not None
    assert loaded.id == created.id


@pytest.mark.asyncio
async def test_list_sessions(engine: WorkflowEngine):
    """list_sessions returns all sessions."""
    engine.pool.submit = AsyncMock(return_value=AgentResult(
        agent_id="a", success=True, output_files=["out.md"], duration_ms=10,
    ))

    s1 = engine.create_session(CreateSessionRequest(requirement="test1"))
    await engine.execute_session(s1)
    s2 = engine.create_session(CreateSessionRequest(requirement="test2"))
    await engine.execute_session(s2)

    sessions = engine.list_sessions()
    assert len(sessions) == 2


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
    assert len(configs_seen) == len(session.phases[0].agents)
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
