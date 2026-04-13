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


class SessionConfig(BaseModel):
    rounds: int = 3


class CreateSessionRequest(BaseModel):
    requirement: str
    mode: SessionMode = SessionMode.DEFAULT
    agents: list[str] | None = None
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

    @classmethod
    def from_request(cls, req: CreateSessionRequest, session_id: str) -> "Session":
        if req.mode == SessionMode.DEFAULT:
            phases = [
                Phase(id=1, name="需求分析", agents=["analyst"]),
                Phase(id=2, name="方案设计", agents=["architect", "researcher"]),
                Phase(id=3, name="整合输出", agents=["writer"]),
            ]
        else:
            agents = req.agents or ["analyst", "architect", "researcher"]
            phases = [
                Phase(id=1, name="头脑风暴", agents=agents),
                Phase(id=2, name="整合输出", agents=["writer"]),
            ]
        return cls(
            id=session_id,
            mode=req.mode,
            input_requirement=req.requirement,
            phases=phases,
        )


class AgentDefinition(BaseModel):
    name: str
    id: str
    model: str = "claude-sonnet-4-20250514"
    max_turns: int = 20
    system_prompt: str
    output_file: str | None = None
    output_template: str | None = None


class AgentResult(BaseModel):
    agent_id: str
    success: bool
    output_files: list[str] = Field(default_factory=list)
    error: str | None = None
    duration_ms: int = 0
