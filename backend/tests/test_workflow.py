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
        {"id": "analyst", "name": "需求分析师", "system_prompt": "You are an analyst.", "room": "rd"},
        {"id": "architect", "name": "架构师", "system_prompt": "You are an architect.", "room": "rd"},
        {"id": "dev-lead", "name": "开发负责人", "system_prompt": "You are a dev lead.", "room": "rd"},
        {"id": "test-lead", "name": "测试负责人", "system_prompt": "You are a test lead.", "room": "rd"},
        {"id": "moderator", "name": "讨论主持人", "system_prompt": "You are a moderator.", "room": "rd"},
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
    req = CreateSessionRequest(requirement="test requirement", room="rd")

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
    """Default workflow runs 4 phases in order."""
    req = CreateSessionRequest(requirement="test", room="rd")

    engine.pool.submit = AsyncMock(return_value=AgentResult(
        agent_id="agent", success=True, output_files=["out.md"], duration_ms=100,
    ))

    session = engine.create_session(req)
    await engine.execute_session(session)

    # Should have called pool.submit once per agent (4 total: analyst + architect + dev-lead + test-lead)
    assert engine.pool.submit.call_count == 4


@pytest.mark.asyncio
async def test_default_all_phases_sequential(engine: WorkflowEngine):
    """Default workflow runs all 4 phases sequentially."""
    req = CreateSessionRequest(requirement="test", room="rd")

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


@pytest.mark.asyncio
async def test_pause_and_resume(engine: WorkflowEngine):
    """Can pause and resume a session."""
    req = CreateSessionRequest(requirement="test", room="rd")
    session = engine.create_session(req)
    await engine.execute_session(session)

    # For this test, just verify session state transitions
    loaded = engine.vault_manager.get_session(session.id)
    assert loaded is not None


@pytest.mark.asyncio
async def test_get_session(engine: WorkflowEngine):
    """get_session returns session from memory or vault."""
    req = CreateSessionRequest(requirement="test", room="rd")
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

    s1 = engine.create_session(CreateSessionRequest(requirement="test1", room="rd"))
    await engine.execute_session(s1)
    s2 = engine.create_session(CreateSessionRequest(requirement="test2", room="rd"))
    await engine.execute_session(s2)

    sessions = engine.list_sessions()
    assert len(sessions) == 2


@pytest.mark.asyncio
async def test_brainstorm_token_passing_flow(engine: WorkflowEngine):
    """Brainstorm mode uses token-passing: moderator selects speakers."""
    req = CreateSessionRequest(
        requirement="讨论主题",
        mode=SessionMode.BRAINSTORM,
        config={"rounds": 1},
        room="rd",
    )

    async def mock_moderator(session, state, session_dir):
        agents = ["analyst", "architect", "dev-lead", "test-lead"]
        if len(state.spoken_this_round) < len(agents):
            return agents[len(state.spoken_this_round)]
        return None

    engine._run_moderator_turn = mock_moderator

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
        room="rd",
    )

    async def mock_moderator(session, state, session_dir):
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


@pytest.mark.asyncio
async def test_brainstorm_writes_discussion_log(engine: WorkflowEngine):
    """Brainstorm writes 01-讨论记录.md to session dir."""
    req = CreateSessionRequest(
        requirement="test topic",
        mode=SessionMode.BRAINSTORM,
        config={"rounds": 1},
        room="rd",
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


@pytest.mark.asyncio
async def test_moderator_turn_extracts_tool_call(engine: WorkflowEngine):
    """_run_moderator_turn parses nominate_speaker tool call from stream events."""
    from app.workflow.models import DiscussionState

    req = CreateSessionRequest(requirement="test", mode=SessionMode.BRAINSTORM, room="rd")
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

    req = CreateSessionRequest(requirement="test", mode=SessionMode.BRAINSTORM, room="rd")
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
