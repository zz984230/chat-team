from datetime import datetime
from enum import StrEnum
from pathlib import Path

from pydantic import BaseModel, Field


class SessionStatus(StrEnum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SessionMode(StrEnum):
    DEFAULT = "default"
    BRAINSTORM = "brainstorm"


class PhaseStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class SessionConfig(BaseModel):
    rounds: int = 1


class CreateSessionRequest(BaseModel):
    requirement: str
    mode: SessionMode = SessionMode.DEFAULT
    agents: list[str] | None = None
    room: str  # Required
    config: SessionConfig = Field(default_factory=SessionConfig)


class Phase(BaseModel):
    id: int
    name: str
    agents: list[str]
    status: PhaseStatus = PhaseStatus.PENDING
    started_at: datetime | None = None
    completed_at: datetime | None = None
    outputs: list[str] = Field(default_factory=list)


class SessionInput(BaseModel):
    requirement: str


class Session(BaseModel):
    id: str
    status: SessionStatus = SessionStatus.CREATED
    mode: SessionMode = SessionMode.DEFAULT
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    input_requirement: str = ""
    phases: list[Phase] = Field(default_factory=list)
    config_rounds: int = 1

    @classmethod
    def from_request(cls, req: CreateSessionRequest, session_id: str) -> "Session":
        if req.mode == SessionMode.DEFAULT:
            phases = [
                Phase(id=1, name="需求分析", agents=["analyst"]),
                Phase(id=2, name="方案设计", agents=["architect"]),
                Phase(id=3, name="开发任务", agents=["dev-lead"]),
                Phase(id=4, name="测试计划", agents=["test-lead"]),
            ]
        else:
            phases = [
                Phase(id=1, name="讨论", agents=["analyst", "architect", "dev-lead", "test-lead"]),
            ]
        return cls(
            id=session_id,
            mode=req.mode,
            input_requirement=req.requirement,
            phases=phases,
            config_rounds=req.config.rounds,
        )


class AgentDefinition(BaseModel):
    name: str
    id: str
    model: str = "claude-sonnet-4-20250514"
    max_turns: int = 20
    system_prompt: str
    output_file: str | None = None
    output_template: str | None = None
    casual_prompt: str | None = None
    room: str = "rd"


class AgentResult(BaseModel):
    agent_id: str
    success: bool
    output_files: list[str] = Field(default_factory=list)
    error: str | None = None
    duration_ms: int = 0


class DiscussionTurn(BaseModel):
    round: int
    agent_id: str
    content: str


class DiscussionState(BaseModel):
    rounds_total: int
    current_round: int = 1
    spoken_this_round: list[str] = []
    turns: list[DiscussionTurn] = []
