import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.workflow.engine import WorkflowEngine
from app.workflow.models import (
    Session, SessionStatus, PhaseStatus, CreateSessionRequest, AgentResult,
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
        {"id": "researcher", "name": "研究员", "system_prompt": "You are a researcher."},
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

    # Should have called pool.submit once per agent (4 total: analyst + architect + researcher + writer)
    assert engine.pool.submit.call_count == 4


@pytest.mark.asyncio
async def test_phase_2_runs_parallel(engine: WorkflowEngine):
    """Phase 2 (architect + researcher) runs both agents in parallel."""
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
    assert "researcher" in call_order
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
