from datetime import datetime
from app.workflow.models import (
    Session, SessionStatus, SessionMode,
    Phase, PhaseStatus,
    AgentDefinition, AgentResult,
    CreateSessionRequest,
)


def test_session_status_values():
    assert SessionStatus.CREATED == "created"
    assert SessionStatus.RUNNING == "running"
    assert SessionStatus.PAUSED == "paused"
    assert SessionStatus.COMPLETED == "completed"
    assert SessionStatus.FAILED == "failed"
    assert SessionStatus.CANCELLED == "cancelled"


def test_create_session_request_defaults():
    req = CreateSessionRequest(requirement="设计一个电商系统")
    assert req.mode == SessionMode.DEFAULT
    assert req.agents is None
    assert req.config.rounds == 3


def test_create_session_request_custom():
    req = CreateSessionRequest(
        requirement="test",
        mode=SessionMode.BRAINSTORM,
        agents=["analyst", "architect"],
        config={"rounds": 5},
    )
    assert req.mode == SessionMode.BRAINSTORM
    assert req.agents == ["analyst", "architect"]
    assert req.config.rounds == 5


def test_phase_defaults():
    phase = Phase(id=1, name="需求分析", agents=["analyst"])
    assert phase.status == PhaseStatus.PENDING
    assert phase.outputs == []
    assert phase.started_at is None


def test_session_from_request():
    req = CreateSessionRequest(requirement="test requirement")
    session = Session.from_request(req, "20260413-153000-abc")
    assert session.id == "20260413-153000-abc"
    assert session.status == SessionStatus.CREATED
    assert session.input_requirement == "test requirement"
    assert len(session.phases) == 4  # default mode has 4 phases


def test_agent_definition_from_yaml():
    data = {
        "name": "需求分析师",
        "id": "analyst",
        "model": "claude-sonnet-4-20250514",
        "max_turns": 20,
        "system_prompt": "你是一位资深需求分析师。",
        "output_file": "01-需求澄清.md",
    }
    agent = AgentDefinition(**data)
    assert agent.id == "analyst"
    assert agent.max_turns == 20


def test_agent_result_success():
    result = AgentResult(
        agent_id="analyst",
        success=True,
        output_files=["01-需求澄清.md"],
        duration_ms=15000,
    )
    assert result.success is True
    assert result.error is None


def test_agent_result_failure():
    result = AgentResult(
        agent_id="analyst",
        success=False,
        error="timeout after 300s",
        duration_ms=300000,
    )
    assert result.success is False
    assert result.output_files == []


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
