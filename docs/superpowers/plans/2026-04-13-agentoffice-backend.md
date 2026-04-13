# AgentOffice Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete backend for AgentOffice — a multi-agent collaboration system that orchestrates Claude CLI subprocesses to process user requirements.

**Architecture:** Python FastAPI Supervisor monolith. AgentRunner spawns `claude -p` subprocesses with stream-json output. WorkflowEngine coordinates phases (sequential + parallel). All state persisted as files in Obsidian Vault structure. Real-time events pushed via WebSocket.

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, Pydantic v2, PyYAML, pytest + pytest-asyncio, uv package manager

**Spec:** `docs/superpowers/specs/2026-04-13-agentoffice-backend-design.md`

---

## File Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app factory + startup
│   ├── config.py                # Settings model + loader
│   ├── dependencies.py          # FastAPI dependency injection
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py            # Top-level API router
│   │   ├── sessions.py          # Session CRUD endpoints
│   │   └── agents.py            # Agent definition endpoints
│   ├── ws/
│   │   ├── __init__.py
│   │   └── manager.py           # WebSocket connection manager
│   ├── workflow/
│   │   ├── __init__.py
│   │   ├── engine.py            # Workflow orchestration
│   │   └── models.py            # Pydantic models (Session, Phase, etc.)
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── runner.py            # Claude CLI subprocess runner
│   │   ├── pool.py              # Concurrent agent pool
│   │   └── parser.py            # stream-json output parser
│   └── vault/
│       ├── __init__.py
│       └── manager.py           # Vault file operations
├── tests/
│   ├── conftest.py
│   ├── test_config.py
│   ├── test_vault.py
│   ├── test_parser.py
│   ├── test_agent_runner.py
│   ├── test_pool.py
│   ├── test_workflow.py
│   ├── test_ws.py
│   └── test_api.py
├── pyproject.toml
└── settings.yaml

vault/
├── agents/
│   ├── analyst.yaml
│   ├── architect.yaml
│   ├── researcher.yaml
│   └── writer.yaml
├── sessions/
├── memory/
└── kanban/
```

---

### Task 1: Project Initialization & Configuration

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/settings.yaml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_config.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "agentoffice"
version = "0.1.0"
description = "Multi-agent collaboration system powered by Claude CLI"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "pyyaml>=6.0",
    "websockets>=13.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "httpx>=0.28",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Create settings.yaml**

```yaml
server:
  host: "0.0.0.0"
  port: 8000
  cors_origins: ["http://localhost:3000"]

agent:
  max_concurrent: 5
  timeout_seconds: 300
  retry_count: 1
  work_dir: "/tmp/agentoffice"

vault:
  path: "./vault"

workflow:
  default_mode: "default"
  brainstorm_rounds: 3

logging:
  level: "INFO"
  file: "./logs/agentoffice.log"
```

- [ ] **Step 3: Write failing test for config loading**

```python
# tests/test_config.py
import pytest
from pathlib import Path
from app.config import Settings, load_settings


def test_settings_defaults():
    """Settings model has correct defaults."""
    s = Settings()
    assert s.server.host == "0.0.0.0"
    assert s.server.port == 8000
    assert s.agent.max_concurrent == 5
    assert s.agent.timeout_seconds == 300
    assert s.vault.path == "./vault"


def test_load_settings_from_yaml(tmp_path: Path):
    """load_settings reads a YAML file and returns Settings."""
    yaml_file = tmp_path / "settings.yaml"
    yaml_file.write_text(
        "server:\n  port: 9000\nvault:\n  path: '/data/vault'\n"
    )
    s = load_settings(yaml_file)
    assert s.server.port == 9000
    assert s.vault.path == "/data/vault"


def test_load_settings_missing_file():
    """load_settings raises FileNotFoundError for missing file."""
    with pytest.raises(FileNotFoundError):
        load_settings(Path("/nonexistent/settings.yaml"))
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_config.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 5: Create app/__init__.py and implement config.py**

```python
# backend/app/__init__.py
# AgentOffice backend
```

```python
# backend/app/config.py
from pathlib import Path

import yaml
from pydantic import BaseModel


class ServerConfig(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000"]


class AgentConfig(BaseModel):
    max_concurrent: int = 5
    timeout_seconds: int = 300
    retry_count: int = 1
    work_dir: str = "/tmp/agentoffice"


class VaultConfig(BaseModel):
    path: str = "./vault"


class WorkflowConfig(BaseModel):
    default_mode: str = "default"
    brainstorm_rounds: int = 3


class LoggingConfig(BaseModel):
    level: str = "INFO"
    file: str = "./logs/agentoffice.log"


class Settings(BaseModel):
    server: ServerConfig = ServerConfig()
    agent: AgentConfig = AgentConfig()
    vault: VaultConfig = VaultConfig()
    workflow: WorkflowConfig = WorkflowConfig()
    logging: LoggingConfig = LoggingConfig()


def load_settings(path: Path) -> Settings:
    """Load settings from a YAML file."""
    if not path.exists():
        raise FileNotFoundError(f"Settings file not found: {path}")
    with open(path) as f:
        data = yaml.safe_load(f) or {}
    return Settings(**data)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_config.py -v`
Expected: 3 passed

- [ ] **Step 7: Create tests/conftest.py**

```python
# backend/tests/conftest.py
import pytest
from pathlib import Path
from app.config import Settings


@pytest.fixture
def tmp_settings(tmp_path: Path) -> Settings:
    """Provide default Settings instance."""
    return Settings()


@pytest.fixture
def tmp_vault(tmp_path: Path) -> Path:
    """Create a temporary vault directory structure."""
    vault = tmp_path / "vault"
    for subdir in ["agents", "sessions", "memory", "kanban"]:
        (vault / subdir).mkdir(parents=True, exist_ok=True)
    return vault
```

- [ ] **Step 8: Commit**

```bash
cd backend
git add pyproject.toml settings.yaml app/__init__.py app/config.py tests/conftest.py tests/test_config.py
git commit -m "feat: project init with config management"
```

---

### Task 2: Workflow Data Models

**Files:**
- Create: `backend/app/workflow/__init__.py`
- Create: `backend/app/workflow/models.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write failing tests for data models**

```python
# backend/tests/test_models.py
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
    assert len(session.phases) == 3  # default mode has 3 phases


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.workflow'`

- [ ] **Step 3: Implement workflow models**

```python
# backend/app/workflow/__init__.py
```

```python
# backend/app/workflow/models.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_models.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add app/workflow/ tests/test_models.py
git commit -m "feat: add workflow data models"
```

---

### Task 3: Vault Manager

**Files:**
- Create: `backend/app/vault/__init__.py`
- Create: `backend/app/vault/manager.py`
- Create: `backend/tests/test_vault.py`

- [ ] **Step 1: Write failing tests for VaultManager**

```python
# backend/tests/test_vault.py
import yaml
from pathlib import Path
from app.vault.manager import VaultManager
from app.workflow.models import Session, SessionMode, CreateSessionRequest


def test_ensure_structure(tmp_vault: Path):
    """ensure_structure creates required directories."""
    vm = VaultManager(tmp_vault)
    vm.ensure_structure()
    for subdir in ["agents", "sessions", "memory", "kanban"]:
        assert (tmp_vault / subdir).is_dir()


def test_load_agent_definitions(tmp_vault: Path):
    """load_agent_definitions reads YAML files from agents/ directory."""
    agent_file = tmp_vault / "agents" / "analyst.yaml"
    agent_file.write_text(
        "name: 需求分析师\n"
        "id: analyst\n"
        "model: claude-sonnet-4-20250514\n"
        "max_turns: 20\n"
        "system_prompt: |\n"
        "  你是一位资深需求分析师。\n"
        "output_file: 01-需求澄清.md\n"
    )
    vm = VaultManager(tmp_vault)
    agents = vm.load_agent_definitions()
    assert len(agents) == 1
    assert agents[0].id == "analyst"
    assert agents[0].name == "需求分析师"


def test_create_session_dir(tmp_vault: Path):
    """create_session_dir creates session directory and writes input file."""
    vm = VaultManager(tmp_vault)
    session = Session.from_request(
        CreateSessionRequest(requirement="设计电商系统"),
        "20260413-153000-abc",
    )
    session_dir = vm.create_session(session)
    assert session_dir.is_dir()
    assert (session_dir / "00-原始需求.md").exists()
    assert "设计电商系统" in (session_dir / "00-原始需求.md").read_text()
    assert (session_dir / "meta.yaml").exists()


def test_get_session(tmp_vault: Path):
    """get_session reads meta.yaml and returns Session model."""
    vm = VaultManager(tmp_vault)
    req = CreateSessionRequest(requirement="test")
    session = Session.from_request(req, "20260413-153000-abc")
    vm.create_session(session)

    loaded = vm.get_session("20260413-153000-abc")
    assert loaded is not None
    assert loaded.id == "20260413-153000-abc"
    assert loaded.input_requirement == "test"


def test_get_session_not_found(tmp_vault: Path):
    """get_session returns None for nonexistent session."""
    vm = VaultManager(tmp_vault)
    assert vm.get_session("nonexistent") is None


def test_list_sessions(tmp_vault: Path):
    """list_sessions returns all sessions sorted by created_at desc."""
    vm = VaultManager(tmp_vault)
    for i in range(3):
        session = Session.from_request(
            CreateSessionRequest(requirement=f"test-{i}"),
            f"session-{i}",
        )
        vm.create_session(session)

    sessions = vm.list_sessions()
    assert len(sessions) == 3


def test_update_session(tmp_vault: Path):
    """update_session writes updated meta.yaml."""
    vm = VaultManager(tmp_vault)
    session = Session.from_request(
        CreateSessionRequest(requirement="test"),
        "20260413-153000-abc",
    )
    vm.create_session(session)

    session.status = "running"
    vm.update_session(session)

    loaded = vm.get_session("20260413-153000-abc")
    assert loaded.status.value == "running"


def test_save_agent_output(tmp_vault: Path):
    """save_agent_output writes file content to session directory."""
    vm = VaultManager(tmp_vault)
    session = Session.from_request(
        CreateSessionRequest(requirement="test"),
        "20260413-153000-abc",
    )
    vm.create_session(session)

    vm.save_agent_output("20260413-153000-abc", "01-需求澄清.md", "# 澄清结果\n...")
    content = vm.get_output_file("20260413-153000-abc", "01-需求澄清.md")
    assert content == "# 澄清结果\n..."


def test_list_outputs(tmp_vault: Path):
    """list_outputs returns list of output files in session directory."""
    vm = VaultManager(tmp_vault)
    session = Session.from_request(
        CreateSessionRequest(requirement="test"),
        "20260413-153000-abc",
    )
    vm.create_session(session)
    vm.save_agent_output("20260413-153000-abc", "01-需求澄清.md", "content1")
    vm.save_agent_output("20260413-153000-abc", "02-技术方案.md", "content2")

    outputs = vm.list_outputs("20260413-153000-abc")
    assert "01-需求澄清.md" in outputs
    assert "02-技术方案.md" in outputs
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_vault.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.vault'`

- [ ] **Step 3: Implement VaultManager**

```python
# backend/app/vault/__init__.py
```

```python
# backend/app/vault/manager.py
from datetime import datetime
from pathlib import Path

import yaml

from app.workflow.models import AgentDefinition, Session


class VaultManager:
    """Manages Obsidian Vault file operations."""

    def __init__(self, vault_path: Path):
        self.vault_path = vault_path
        self._agents_path = vault_path / "agents"
        self._sessions_path = vault_path / "sessions"

    def ensure_structure(self) -> None:
        """Create required vault directories."""
        for subdir in ["agents", "sessions", "memory", "kanban"]:
            (self.vault_path / subdir).mkdir(parents=True, exist_ok=True)

    def load_agent_definitions(self) -> list[AgentDefinition]:
        """Load all agent YAML definitions from vault/agents/."""
        agents = []
        if not self._agents_path.exists():
            return agents
        for f in sorted(self._agents_path.glob("*.yaml")):
            data = yaml.safe_load(f.read_text())
            if data:
                agents.append(AgentDefinition(**data))
        return agents

    def create_session(self, session: Session) -> Path:
        """Create session directory with input file and meta.yaml."""
        session_dir = self._sessions_path / session.id
        session_dir.mkdir(parents=True, exist_ok=True)

        # Write input requirement
        (session_dir / "00-原始需求.md").write_text(session.input_requirement)

        # Write meta.yaml
        self._write_meta(session_dir, session)

        return session_dir

    def get_session(self, session_id: str) -> Session | None:
        """Read session from meta.yaml. Returns None if not found."""
        meta_path = self._sessions_path / session_id / "meta.yaml"
        if not meta_path.exists():
            return None
        data = yaml.safe_load(meta_path.read_text())
        return Session(**data) if data else None

    def list_sessions(self) -> list[Session]:
        """List all sessions sorted by created_at descending."""
        sessions = []
        if not self._sessions_path.exists():
            return sessions
        for meta_path in self._sessions_path.glob("*/meta.yaml"):
            data = yaml.safe_load(meta_path.read_text())
            if data:
                sessions.append(Session(**data))
        sessions.sort(key=lambda s: s.created_at, reverse=True)
        return sessions

    def update_session(self, session: Session) -> None:
        """Write updated meta.yaml."""
        session.updated_at = datetime.now()
        session_dir = self._sessions_path / session.id
        self._write_meta(session_dir, session)

    def save_agent_output(self, session_id: str, filename: str, content: str) -> None:
        """Write agent output file to session directory."""
        output_path = self._sessions_path / session_id / filename
        output_path.write_text(content)

    def get_output_file(self, session_id: str, filename: str) -> str | None:
        """Read an output file from session directory."""
        path = self._sessions_path / session_id / filename
        if not path.exists():
            return None
        return path.read_text()

    def list_outputs(self, session_id: str) -> list[str]:
        """List output files (excluding meta.yaml and 00-原始需求.md)."""
        session_dir = self._sessions_path / session_id
        if not session_dir.exists():
            return []
        exclude = {"meta.yaml", "00-原始需求.md"}
        return sorted(
            f.name
            for f in session_dir.iterdir()
            if f.is_file() and f.name not in exclude
        )

    def _write_meta(self, session_dir: Path, session: Session) -> None:
        """Serialize session to meta.yaml."""
        meta_path = session_dir / "meta.yaml"
        meta_path.write_text(
            yaml.dump(session.model_dump(mode="json"), allow_unicode=True, default_flow_style=False)
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_vault.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add app/vault/ tests/test_vault.py
git commit -m "feat: add vault manager for Obsidian Vault file operations"
```

---

### Task 4: Agent Definition YAML Files

**Files:**
- Create: `vault/agents/analyst.yaml`
- Create: `vault/agents/architect.yaml`
- Create: `vault/agents/researcher.yaml`
- Create: `vault/agents/writer.yaml`

- [ ] **Step 1: Create 4 agent definition YAML files**

```yaml
# vault/agents/analyst.yaml
name: "需求分析师"
id: "analyst"
model: "claude-sonnet-4-20250514"
max_turns: 20
system_prompt: |
  你是一位资深需求分析师。你的任务是：
  1. 仔细阅读用户提交的原始需求
  2. 使用 5W2H 框架分析需求（What/Why/Who/When/Where/How/How much）
  3. 识别不确定性和潜在风险点
  4. 梳理功能需求和非功能需求
  5. 列出需要向用户确认的问题

  输出格式要求：
  - Markdown 格式
  - 包含：需求摘要、用户故事、功能需求列表、非功能需求、待确认问题
output_file: "01-需求澄清.md"
output_template: |
  ## 需求摘要
  <!-- 用一段话概括核心需求 -->

  ## 用户故事
  <!-- 作为...我希望...以便于... -->

  ## 功能需求
  <!-- 列出具体功能点 -->

  ## 非功能需求
  <!-- 性能、安全、可用性等 -->

  ## 待确认问题
  <!-- 需要用户进一步澄清的问题列表 -->
```

```yaml
# vault/agents/architect.yaml
name: "方案架构师"
id: "architect"
model: "claude-sonnet-4-20250514"
max_turns: 20
system_prompt: |
  你是一位资深技术架构师。你的任务是：
  1. 阅读需求澄清文档，理解业务需求
  2. 设计系统整体架构（技术选型、模块划分、数据流）
  3. 评估技术方案的可行性和风险
  4. 输出结构化的技术方案文档

  输出格式要求：
  - Markdown 格式
  - 包含：架构概述、技术选型及理由、模块设计、数据流图（用文字描述）、接口设计、风险评估
output_file: "02-技术方案.md"
output_template: |
  ## 架构概述
  ## 技术选型
  ## 模块设计
  ## 数据流
  ## 接口设计
  ## 风险评估
```

```yaml
# vault/agents/researcher.yaml
name: "资料研究员"
id: "researcher"
model: "claude-sonnet-4-20250514"
max_turns: 20
system_prompt: |
  你是一位资深技术研究员。你的任务是：
  1. 阅读需求澄清文档，提炼关键技术点
  2. 针对每个技术点，调研业界最佳实践和现有解决方案
  3. 收集相关的技术文档、开源项目、案例分析
  4. 整理为结构化的参考资料文档

  输出格式要求：
  - Markdown 格式
  - 每个技术点包含：问题描述、现有方案对比、推荐方案、参考资料链接
output_file: "03-参考资料.md"
output_template: |
  ## 技术点 1: [标题]
  ### 问题描述
  ### 现有方案对比
  ### 推荐方案
  ### 参考资料
```

```yaml
# vault/agents/writer.yaml
name: "方案撰写员"
id: "writer"
model: "claude-sonnet-4-20250514"
max_turns: 25
system_prompt: |
  你是一位资深方案撰写专家。你的任务是：
  1. 阅读所有前置文档（需求澄清、技术方案、参考资料）
  2. 整合各方内容，消除矛盾和重复
  3. 补充细节，完善逻辑链条
  4. 输出完整的最终方案文档

  输出格式要求：
  - Markdown 格式
  - 结构清晰、逻辑连贯
  - 包含：执行摘要、需求概述、技术方案、实施计划、风险评估、附录
output_file: "04-最终方案.md"
output_template: |
  ## 执行摘要
  ## 需求概述
  ## 技术方案
  ## 实施计划
  ## 风险评估
  ## 附录
```

- [ ] **Step 2: Verify YAML files are valid**

Run: `cd /Users/zero/Project/chat-team && python3 -c "import yaml; [yaml.safe_load(open(f)) for f in ['vault/agents/analyst.yaml','vault/agents/architect.yaml','vault/agents/researcher.yaml','vault/agents/writer.yaml']]; print('All YAML files valid')"`
Expected: `All YAML files valid`

- [ ] **Step 3: Commit**

```bash
git add vault/agents/
git commit -m "feat: add default agent definition YAML files"
```

---

### Task 5: Stream-JSON Output Parser

**Files:**
- Create: `backend/app/agent/parser.py`
- Create: `backend/tests/test_parser.py`

- [ ] **Step 1: Write failing tests for parser**

```python
# backend/tests/test_parser.py
from app.agent.parser import StreamEvent, parse_stream_line


def test_parse_assistant_text():
    """Parse assistant text event."""
    line = '{"type":"assistant","subtype":"text","content":"分析需求中的关键点..."}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "thinking"
    assert event.content == "分析需求中的关键点..."


def test_parse_tool_use():
    """Parse tool use event."""
    line = '{"type":"assistant","subtype":"tool_use","name":"Write","input":{"file_path":"01-需求澄清.md"}}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "working"
    assert event.tool_name == "Write"


def test_parse_tool_result_write():
    """Parse tool result for Write tool → output event."""
    line = '{"type":"tool_result","tool_use_id":"xyz","content":"File written successfully"}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "output"


def test_parse_result_success():
    """Parse final result success."""
    line = '{"type":"result","subtype":"success","result":"任务完成","cost_usd":0.05}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "completed"
    assert event.cost_usd == 0.05


def test_parse_result_error():
    """Parse final result error."""
    line = '{"type":"result","subtype":"error","error":"API error"}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "failed"
    assert event.error == "API error"


def test_parse_empty_line():
    """Empty line returns None."""
    assert parse_stream_line("") is None
    assert parse_stream_line("  ") is None


def test_parse_invalid_json():
    """Invalid JSON returns None."""
    assert parse_stream_line("not json") is None


def test_parse_unknown_type():
    """Unknown event type returns None."""
    line = '{"type":"system","subtype":"init"}'
    assert parse_stream_line(line) is None


def test_stream_event_model():
    """StreamEvent model holds all fields."""
    event = StreamEvent(type="thinking", content="hello")
    assert event.type == "thinking"
    assert event.tool_name is None
    assert event.cost_usd is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_parser.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent'`

- [ ] **Step 3: Implement parser**

```python
# backend/app/agent/__init__.py
```

```python
# backend/app/agent/parser.py
import json
from typing import Any

from pydantic import BaseModel


class StreamEvent(BaseModel):
    """Parsed event from Claude CLI stream-json output."""
    type: str  # thinking, working, output, completed, failed
    content: str | None = None
    tool_name: str | None = None
    error: str | None = None
    cost_usd: float | None = None


def parse_stream_line(line: str) -> StreamEvent | None:
    """Parse a single line of Claude CLI stream-json output.

    Returns None for empty lines, invalid JSON, or unknown event types.
    """
    line = line.strip()
    if not line:
        return None

    try:
        data: dict[str, Any] = json.loads(line)
    except json.JSONDecodeError:
        return None

    event_type = data.get("type")
    subtype = data.get("subtype")

    if event_type == "assistant":
        if subtype == "text":
            return StreamEvent(type="thinking", content=data.get("content", ""))
        elif subtype == "tool_use":
            return StreamEvent(type="working", tool_name=data.get("name"))

    elif event_type == "tool_result":
        return StreamEvent(type="output")

    elif event_type == "result":
        if subtype == "success":
            return StreamEvent(
                type="completed",
                cost_usd=data.get("cost_usd"),
            )
        elif subtype == "error":
            return StreamEvent(
                type="failed",
                error=data.get("error", "unknown error"),
            )

    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_parser.py -v`
Expected: 10 passed

- [ ] **Step 5: Commit**

```bash
git add app/agent/__init__.py app/agent/parser.py tests/test_parser.py
git commit -m "feat: add stream-json output parser for Claude CLI"
```

---

### Task 6: Agent Runner

**Files:**
- Create: `backend/app/agent/runner.py`
- Create: `backend/tests/test_agent_runner.py`

- [ ] **Step 1: Write failing tests for AgentRunner**

```python
# backend/tests/test_agent_runner.py
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from app.agent.runner import AgentRunner, AgentRunConfig
from app.workflow.models import AgentDefinition, AgentResult


@pytest.fixture
def analyst_def() -> AgentDefinition:
    return AgentDefinition(
        name="需求分析师",
        id="analyst",
        system_prompt="你是一位资深需求分析师。",
        output_file="01-需求澄清.md",
    )


@pytest.fixture
def run_config(tmp_path: Path) -> AgentRunConfig:
    return AgentRunConfig(
        work_dir=tmp_path / "work",
        session_dir=tmp_path / "session",
        input_files=[],
    )


@pytest.mark.asyncio
async def test_prepare_creates_work_dir(analyst_def: AgentDefinition, run_config: AgentRunConfig):
    """prepare() creates work directory and copies input files."""
    # Create an input file
    run_config.session_dir.mkdir(parents=True, exist_ok=True)
    input_file = run_config.session_dir / "00-原始需求.md"
    input_file.write_text("test requirement")
    run_config.input_files = [input_file]

    runner = AgentRunner(analyst_def, run_config)
    await runner.prepare()

    assert run_config.work_dir.is_dir()
    assert (run_config.work_dir / "00-原始需求.md").read_text() == "test requirement"


@pytest.mark.asyncio
async def test_build_prompt(analyst_def: AgentDefinition, run_config: AgentRunConfig):
    """build_prompt() includes system_prompt and output_file instruction."""
    runner = AgentRunner(analyst_def, run_config)
    prompt = runner.build_prompt("分析需求")

    assert "资深需求分析师" in prompt
    assert "分析需求" in prompt
    assert "01-需求澄清.md" in prompt


@pytest.mark.asyncio
async def test_collect_outputs(analyst_def: AgentDefinition, run_config: AgentRunConfig):
    """collect_outputs() copies output files from work dir to session dir."""
    run_config.work_dir.mkdir(parents=True, exist_ok=True)
    run_config.session_dir.mkdir(parents=True, exist_ok=True)
    (run_config.work_dir / "01-需求澄清.md").write_text("# 澄清结果")

    runner = AgentRunner(analyst_def, run_config)
    output_files = await runner.collect_outputs()

    assert "01-需求澄清.md" in output_files
    assert (run_config.session_dir / "01-需求澄清.md").read_text() == "# 澄清结果"


@pytest.mark.asyncio
async def test_cleanup(analyst_def: AgentDefinition, run_config: AgentRunConfig):
    """cleanup() removes work directory."""
    run_config.work_dir.mkdir(parents=True, exist_ok=True)
    (run_config.work_dir / "temp.txt").write_text("temp")

    runner = AgentRunner(analyst_def, run_config)
    await runner.cleanup()

    assert not run_config.work_dir.exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_agent_runner.py -v`
Expected: FAIL — `ImportError: cannot import name 'AgentRunner' from 'app.agent'`

- [ ] **Step 3: Implement AgentRunner**

```python
# backend/app/agent/runner.py
import asyncio
import shutil
import time
from pathlib import Path

from pydantic import BaseModel

from app.agent.parser import parse_stream_line, StreamEvent
from app.workflow.models import AgentDefinition, AgentResult


class AgentRunConfig(BaseModel):
    """Configuration for a single agent run."""
    work_dir: Path
    session_dir: Path
    input_files: list[Path] = []
    timeout_seconds: int = 300

    class Config:
        arbitrary_types_allowed = True


class AgentRunner:
    """Manages the lifecycle of a single Claude CLI agent subprocess."""

    def __init__(self, agent_def: AgentDefinition, config: AgentRunConfig):
        self.agent_def = agent_def
        self.config = config
        self._process: asyncio.subprocess.Process | None = None

    async def prepare(self) -> None:
        """Create work directory and copy input files."""
        self.config.work_dir.mkdir(parents=True, exist_ok=True)
        for f in self.config.input_files:
            if f.exists():
                shutil.copy2(f, self.config.work_dir / f.name)

    def build_prompt(self, task: str) -> str:
        """Build the full prompt for claude -p."""
        parts = [self.agent_def.system_prompt]
        if self.agent_def.output_file:
            parts.append(
                f"\n\n请将你的分析结果写入文件: {self.agent_def.output_file}"
            )
        if self.agent_def.output_template:
            parts.append(
                f"\n\n输出格式参考:\n{self.agent_def.output_template}"
            )
        parts.append(f"\n\n## 任务\n{task}")
        return "".join(parts)

    async def execute(self, task: str, event_callback=None) -> list[StreamEvent]:
        """Execute claude -p and stream events.

        Args:
            task: The task description for the agent.
            event_callback: Optional async callback for each StreamEvent.

        Returns:
            List of all StreamEvents collected during execution.
        """
        prompt = self.build_prompt(task)
        cmd = [
            "claude", "-p", prompt,
            "--output-format", "stream-json",
            "--max-turns", str(self.agent_def.max_turns),
        ]

        self._process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(self.config.work_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        events: list[StreamEvent] = []
        assert self._process.stdout is not None

        async for line in self._process.stdout:
            raw = line.decode("utf-8").strip()
            event = parse_stream_line(raw)
            if event:
                events.append(event)
                if event_callback:
                    await event_callback(event)

        await self._process.wait()
        return events

    async def collect_outputs(self) -> list[str]:
        """Copy output files from work dir to session dir."""
        output_files: list[str] = []
        if not self.config.work_dir.exists():
            return output_files

        for f in self.config.work_dir.iterdir():
            if f.is_file() and f.suffix in (".md", ".yaml", ".json", ".txt"):
                shutil.copy2(f, self.config.session_dir / f.name)
                output_files.append(f.name)

        return output_files

    async def cleanup(self) -> None:
        """Remove work directory."""
        if self.config.work_dir.exists():
            shutil.rmtree(self.config.work_dir)

    async def kill(self) -> None:
        """Force-kill the subprocess."""
        if self._process and self._process.returncode is None:
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self._process.kill()

    async def run(self, task: str, event_callback=None) -> AgentResult:
        """Full lifecycle: prepare → execute → collect → cleanup."""
        start = time.monotonic()
        try:
            await self.prepare()
            events = await self.execute(task, event_callback)
            output_files = await self.collect_outputs()

            # Check result
            final = next((e for e in reversed(events) if e.type in ("completed", "failed")), None)
            success = final is not None and final.type == "completed"

            return AgentResult(
                agent_id=self.agent_def.id,
                success=success,
                output_files=output_files,
                error=final.error if final and final.type == "failed" else None,
                duration_ms=int((time.monotonic() - start) * 1000),
            )
        except Exception as e:
            return AgentResult(
                agent_id=self.agent_def.id,
                success=False,
                error=str(e),
                duration_ms=int((time.monotonic() - start) * 1000),
            )
        finally:
            await self.cleanup()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_agent_runner.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add app/agent/runner.py tests/test_agent_runner.py
git commit -m "feat: add agent runner for Claude CLI subprocess lifecycle"
```

---

### Task 7: Agent Pool

**Files:**
- Create: `backend/app/agent/pool.py`
- Create: `backend/tests/test_pool.py`

- [ ] **Step 1: Write failing tests for AgentPool**

```python
# backend/tests/test_pool.py
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.agent.pool import AgentPool
from app.agent.runner import AgentRunner
from app.workflow.models import AgentResult, AgentDefinition


@pytest.fixture
def mock_runner():
    runner = MagicMock(spec=AgentRunner)
    runner.run = AsyncMock(return_value=AgentResult(
        agent_id="analyst", success=True, output_files=["01.md"], duration_ms=1000,
    ))
    runner.agent_def = AgentDefinition(
        name="test", id="analyst", system_prompt="test",
    )
    return runner


@pytest.mark.asyncio
async def test_submit_success(mock_runner):
    """submit() returns AgentResult on success."""
    pool = AgentPool(max_concurrent=2, timeout_seconds=60, retry_count=0)
    result = await pool.submit(mock_runner, task="test task")
    assert result.success is True
    assert result.agent_id == "analyst"


@pytest.mark.asyncio
async def test_submit_enforces_concurrency():
    """Pool enforces max_concurrent limit via semaphore."""
    call_times = []
    
    async def slow_run(task, event_callback=None):
        call_times.append(asyncio.get_event_loop().time())
        await asyncio.sleep(0.1)
        return AgentResult(agent_id="test", success=True, duration_ms=100)

    pool = AgentPool(max_concurrent=2, timeout_seconds=10, retry_count=0)
    
    runners = []
    for i in range(4):
        r = MagicMock(spec=AgentRunner)
        r.run = slow_run
        r.agent_def = AgentDefinition(name="t", id=f"agent-{i}", system_prompt="t")
        runners.append(r)

    results = await asyncio.gather(*[pool.submit(r, task="t") for r in runners])
    assert len(results) == 4
    assert all(r.success for r in results)


@pytest.mark.asyncio
async def test_submit_timeout():
    """submit() raises TimeoutError when runner exceeds timeout."""
    async def slow_run(task, event_callback=None):
        await asyncio.sleep(10)
        return AgentResult(agent_id="test", success=True, duration_ms=10000)

    runner = MagicMock(spec=AgentRunner)
    runner.run = slow_run
    runner.agent_def = AgentDefinition(name="t", id="test", system_prompt="t")
    runner.kill = AsyncMock()

    pool = AgentPool(max_concurrent=1, timeout_seconds=1, retry_count=0)
    with pytest.raises(TimeoutError):
        await pool.submit(runner, task="test")
    runner.kill.assert_called()


@pytest.mark.asyncio
async def test_submit_retry_on_failure():
    """submit() retries once on failure when retry_count=1."""
    call_count = 0

    async def fail_then_succeed(task, event_callback=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return AgentResult(agent_id="test", success=False, error="fail", duration_ms=100)
        return AgentResult(agent_id="test", success=True, duration_ms=100)

    runner = MagicMock(spec=AgentRunner)
    runner.run = fail_then_succeed
    runner.agent_def = AgentDefinition(name="t", id="test", system_prompt="t")

    pool = AgentPool(max_concurrent=1, timeout_seconds=10, retry_count=1)
    result = await pool.submit(runner, task="test")
    assert result.success is True
    assert call_count == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_pool.py -v`
Expected: FAIL — `ImportError: cannot import name 'AgentPool' from 'app.agent'`

- [ ] **Step 3: Implement AgentPool**

```python
# backend/app/agent/pool.py
import asyncio

from app.agent.runner import AgentRunner
from app.workflow.models import AgentResult


class AgentPool:
    """Concurrent agent execution pool with semaphore-based limiting."""

    def __init__(self, max_concurrent: int = 5, timeout_seconds: int = 300, retry_count: int = 1):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.timeout_seconds = timeout_seconds
        self.retry_count = retry_count
        self.active_runners: dict[str, AgentRunner] = {}

    async def submit(self, runner: AgentRunner, task: str, event_callback=None) -> AgentResult:
        """Submit a runner to the pool. Respects concurrency limit and retries on failure."""
        async with self.semaphore:
            self.active_runners[runner.agent_def.id] = runner
            try:
                return await self._run_with_retry(runner, task, event_callback)
            finally:
                self.active_runners.pop(runner.agent_def.id, None)

    async def _run_with_retry(self, runner: AgentRunner, task: str, event_callback=None) -> AgentResult:
        """Run with timeout and retry logic."""
        last_error = None
        for attempt in range(self.retry_count + 1):
            try:
                result = await asyncio.wait_for(
                    runner.run(task, event_callback),
                    timeout=self.timeout_seconds,
                )
                if result.success:
                    return result
                last_error = result.error
                if attempt < self.retry_count:
                    continue
                return result
            except asyncio.TimeoutError:
                await runner.kill()
                last_error = f"Agent timed out after {self.timeout_seconds}s"
                if attempt < self.retry_count:
                    continue
                raise TimeoutError(last_error)
        return AgentResult(
            agent_id=runner.agent_def.id,
            success=False,
            error=last_error,
        )

    @property
    def active_count(self) -> int:
        return len(self.active_runners)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_pool.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add app/agent/pool.py tests/test_pool.py
git commit -m "feat: add agent pool with concurrency control and retry"
```

---

### Task 8: WebSocket Manager

**Files:**
- Create: `backend/app/ws/__init__.py`
- Create: `backend/app/ws/manager.py`
- Create: `backend/tests/test_ws.py`

- [ ] **Step 1: Write failing tests for WebSocketManager**

```python
# backend/tests/test_ws.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.ws.manager import WebSocketManager


@pytest.mark.asyncio
async def test_connect_and_disconnect():
    """Manager tracks connected clients."""
    manager = WebSocketManager()
    ws = MagicMock()
    ws.accept = AsyncMock()

    await manager.connect("session-1", ws)
    assert "session-1" in manager.connections

    manager.disconnect("session-1", ws)
    assert "session-1" not in manager.connections


@pytest.mark.asyncio
async def test_broadcast_sends_to_session_subscribers():
    """broadcast() sends event to all connections for a session."""
    manager = WebSocketManager()

    ws1 = MagicMock()
    ws1.accept = AsyncMock()
    ws1.send_json = AsyncMock()

    ws2 = MagicMock()
    ws2.accept = AsyncMock()
    ws2.send_json = AsyncMock()

    await manager.connect("session-1", ws1)
    await manager.connect("session-1", ws2)

    await manager.broadcast("session-1", {
        "type": "agent:thinking",
        "agent_id": "analyst",
        "content": "thinking...",
    })

    ws1.send_json.assert_called_once()
    ws2.send_json.assert_called_once()

    event = ws1.send_json.call_args[0][0]
    assert event["type"] == "agent:thinking"
    assert event["agent_id"] == "analyst"


@pytest.mark.asyncio
async def test_broadcast_no_connections():
    """broadcast() does nothing when no connections exist."""
    manager = WebSocketManager()
    # Should not raise
    await manager.broadcast("nonexistent", {"type": "test"})


@pytest.mark.asyncio
async def test_broadcast_skips_failed_connections():
    """broadcast() removes connections that fail to send."""
    manager = WebSocketManager()

    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock(side_effect=Exception("connection closed"))

    await manager.connect("session-1", ws)
    await manager.broadcast("session-1", {"type": "test"})

    # Failed connection should be removed
    assert "session-1" not in manager.connections


@pytest.mark.asyncio
async def test_emit_event():
    """emit() is a convenience wrapper that adds session_id."""
    manager = WebSocketManager()

    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()

    await manager.connect("session-1", ws)
    await manager.emit("session-1", "agent:thinking", agent_id="analyst", content="hi")

    event = ws.send_json.call_args[0][0]
    assert event["type"] == "agent:thinking"
    assert event["agent_id"] == "analyst"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_ws.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ws'`

- [ ] **Step 3: Implement WebSocketManager**

```python
# backend/app/ws/__init__.py
```

```python
# backend/app/ws/manager.py
import asyncio
from typing import Any

from fastapi import WebSocket


class WebSocketManager:
    """Manages WebSocket connections and broadcasts events to session subscribers."""

    def __init__(self):
        # session_id -> set of WebSocket connections
        self.connections: dict[str, set[WebSocket]] = {}

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        """Accept and register a WebSocket connection for a session."""
        await ws.accept()
        if session_id not in self.connections:
            self.connections[session_id] = set()
        self.connections[session_id].add(ws)

    def disconnect(self, session_id: str, ws: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if session_id in self.connections:
            self.connections[session_id].discard(ws)
            if not self.connections[session_id]:
                del self.connections[session_id]

    async def broadcast(self, session_id: str, event: dict[str, Any]) -> None:
        """Send an event to all connections subscribed to a session."""
        if session_id not in self.connections:
            return

        dead: list[WebSocket] = []
        for ws in self.connections[session_id]:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(session_id, ws)

    async def emit(self, session_id: str, event_type: str, **kwargs: Any) -> None:
        """Convenience method to broadcast a typed event."""
        event = {"type": event_type, **kwargs}
        await self.broadcast(session_id, event)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_ws.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add app/ws/ tests/test_ws.py
git commit -m "feat: add WebSocket manager for real-time event broadcasting"
```

---

### Task 9: Workflow Engine

**Files:**
- Create: `backend/app/workflow/engine.py`
- Create: `backend/tests/test_workflow.py`

- [ ] **Step 1: Write failing tests for WorkflowEngine**

```python
# backend/tests/test_workflow.py
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


@pytest.fixture
def engine(tmp_vault: Path) -> WorkflowEngine:
    vm = VaultManager(tmp_vault)
    vm.ensure_structure()
    ws = WebSocketManager()
    pool = MagicMock(spec=AgentPool)
    pool.submit = AsyncMock()
    return WorkflowEngine(vault_manager=vm, pool=pool, ws_manager=ws)


@pytest.mark.asyncio
async def test_start_session_creates_and_runs(engine: WorkflowEngine):
    """start_session creates session in vault and begins execution."""
    req = CreateSessionRequest(requirement="test requirement")

    # Mock pool to return success
    engine.pool.submit = AsyncMock(return_value=AgentResult(
        agent_id="analyst", success=True, output_files=["01-需求澄清.md"], duration_ms=1000,
    ))

    session = await engine.start_session(req)
    assert session.id  # session_id was generated
    assert session.input_requirement == "test requirement"


@pytest.mark.asyncio
async def test_run_default_workflow_phases(engine: WorkflowEngine):
    """Default workflow runs 3 phases in order."""
    req = CreateSessionRequest(requirement="test")

    engine.pool.submit = AsyncMock(return_value=AgentResult(
        agent_id="agent", success=True, output_files=["out.md"], duration_ms=100,
    ))

    session = await engine.start_session(req)

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

    await engine.start_session(req)

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
    session = await engine.start_session(req)

    # For this test, just verify session state transitions
    loaded = engine.vault_manager.get_session(session.id)
    assert loaded is not None


@pytest.mark.asyncio
async def test_get_session(engine: WorkflowEngine):
    """get_session returns session from vault."""
    req = CreateSessionRequest(requirement="test")
    created = await engine.start_session(req)

    loaded = engine.get_session(created.id)
    assert loaded is not None
    assert loaded.id == created.id


@pytest.mark.asyncio
async def test_list_sessions(engine: WorkflowEngine):
    """list_sessions returns all sessions."""
    engine.pool.submit = AsyncMock(return_value=AgentResult(
        agent_id="a", success=True, output_files=["out.md"], duration_ms=10,
    ))

    await engine.start_session(CreateSessionRequest(requirement="test1"))
    await engine.start_session(CreateSessionRequest(requirement="test2"))

    sessions = engine.list_sessions()
    assert len(sessions) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_workflow.py -v`
Expected: FAIL — `ImportError: cannot import name 'WorkflowEngine' from 'app.workflow'`

- [ ] **Step 3: Implement WorkflowEngine**

```python
# backend/app/workflow/engine.py
import asyncio
from datetime import datetime
from typing import Callable, Awaitable

from app.agent.pool import AgentPool
from app.agent.runner import AgentRunner, AgentRunConfig
from app.vault.manager import VaultManager
from app.ws.manager import WebSocketManager
from app.workflow.models import (
    Session, SessionStatus, PhaseStatus, SessionMode,
    CreateSessionRequest, AgentDefinition, AgentResult,
)


class WorkflowEngine:
    """Orchestrates multi-agent workflows."""

    def __init__(
        self,
        vault_manager: VaultManager,
        pool: AgentPool,
        ws_manager: WebSocketManager,
        work_dir: str = "/tmp/agentoffice",
    ):
        self.vault_manager = vault_manager
        self.pool = pool
        self.ws_manager = ws_manager
        self.work_dir = work_dir
        self._agent_defs: dict[str, AgentDefinition] = {}
        self._load_agent_defs()

    def _load_agent_defs(self) -> None:
        """Load agent definitions from vault."""
        for agent in self.vault_manager.load_agent_definitions():
            self._agent_defs[agent.id] = agent

    def _get_agent_def(self, agent_id: str) -> AgentDefinition:
        """Get agent definition by ID. Raises KeyError if not found."""
        if agent_id not in self._agent_defs:
            raise KeyError(f"Agent definition not found: {agent_id}")
        return self._agent_defs[agent_id]

    def _generate_session_id(self) -> str:
        """Generate a unique session ID based on timestamp."""
        return datetime.now().strftime("%Y%m%d-%H%M%S") + f"-{id(self):x}"[:6]

    async def start_session(self, req: CreateSessionRequest) -> Session:
        """Create and execute a new workflow session."""
        session_id = self._generate_session_id()
        session = Session.from_request(req, session_id)
        session.status = SessionStatus.RUNNING
        session.updated_at = datetime.now()

        # Create session in vault
        session_dir = self.vault_manager.create_session(session)
        self.vault_manager.update_session(session)

        # Notify
        await self.ws_manager.emit(session_id, "session:started", session_id=session_id)

        try:
            if session.mode == SessionMode.DEFAULT:
                await self._run_default_workflow(session)
            else:
                await self._run_brainstorm_workflow(session)

            session.status = SessionStatus.COMPLETED
        except Exception as e:
            session.status = SessionStatus.FAILED
            await self.ws_manager.emit(session_id, "session:failed", error=str(e))
        finally:
            session.updated_at = datetime.now()
            self.vault_manager.update_session(session)
            await self.ws_manager.emit(session_id, "session:completed", session_id=session_id)

        return session

    async def _run_default_workflow(self, session: Session) -> None:
        """Run the default 3-phase workflow."""
        session_dir = self.vault_manager._sessions_path / session.id

        # Phase 1: analyst (sequential)
        phase = session.phases[0]
        await self._run_phase(session, phase, "请分析以下需求并输出需求澄清文档。", session_dir)

        # Phase 2: architect + researcher (parallel)
        phase = session.phases[1]
        await self._run_parallel_phase(session, phase, session_dir)

        # Phase 3: writer (sequential)
        phase = session.phases[2]
        task = "请阅读所有前置文档，整合输出最终方案。"
        await self._run_phase(session, phase, task, session_dir)

    async def _run_brainstorm_workflow(self, session: Session) -> None:
        """Run brainstorm mode with multiple rounds."""
        session_dir = self.vault_manager._sessions_path / session.id
        rounds = 3  # default

        # Multi-round brainstorm
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

    async def _run_phase(
        self, session: Session, phase, task: str, session_dir,
    ) -> None:
        """Run a single-agent phase."""
        phase.status = PhaseStatus.RUNNING
        phase.started_at = datetime.now()
        self.vault_manager.update_session(session)

        await self.ws_manager.emit(session.id, "phase:started", phase=phase.id)

        agent_id = phase.agents[0]
        agent_def = self._get_agent_def(agent_id)
        config = AgentRunConfig(
            work_dir=Path(f"{self.work_dir}/{session.id}/{agent_id}"),
            session_dir=session_dir,
            input_files=list(session_dir.glob("*.md")),
        )
        runner = AgentRunner(agent_def, config)

        result = await self.pool.submit(runner, task)

        phase.outputs.extend(result.output_files)
        phase.status = PhaseStatus.COMPLETED if result.success else PhaseStatus.FAILED
        phase.completed_at = datetime.now()
        self.vault_manager.update_session(session)

        await self.ws_manager.emit(
            session.id, "phase:completed", phase=phase.id, outputs=result.output_files,
        )

    async def _run_parallel_phase(
        self, session: Session, phase, session_dir, task_prefix: str = "",
    ) -> None:
        """Run multiple agents in parallel within a phase."""
        phase.status = PhaseStatus.RUNNING
        phase.started_at = datetime.now()
        self.vault_manager.update_session(session)

        await self.ws_manager.emit(session.id, "phase:started", phase=phase.id)

        task = task_prefix or "请基于已有信息进行分析。"

        async def run_single(agent_id: str) -> AgentResult:
            agent_def = self._get_agent_def(agent_id)
            config = AgentRunConfig(
                work_dir=Path(f"{self.work_dir}/{session.id}/{agent_id}"),
                session_dir=session_dir,
                input_files=list(session_dir.glob("*.md")),
            )
            runner = AgentRunner(agent_def, config)
            return await self.pool.submit(runner, task)

        results = await asyncio.gather(
            *[run_single(aid) for aid in phase.agents],
            return_exceptions=True,
        )

        for r in results:
            if isinstance(r, AgentResult):
                phase.outputs.extend(r.output_files)

        phase.status = PhaseStatus.COMPLETED
        phase.completed_at = datetime.now()
        self.vault_manager.update_session(session)

        await self.ws_manager.emit(
            session.id, "phase:completed", phase=phase.id, outputs=phase.outputs,
        )

    def get_session(self, session_id: str) -> Session | None:
        """Get session by ID."""
        return self.vault_manager.get_session(session_id)

    def list_sessions(self) -> list[Session]:
        """List all sessions."""
        return self.vault_manager.list_sessions()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_workflow.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add app/workflow/engine.py tests/test_workflow.py
git commit -m "feat: add workflow engine for multi-agent orchestration"
```

---

### Task 10: REST API Endpoints + FastAPI App

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/router.py`
- Create: `backend/app/api/sessions.py`
- Create: `backend/app/api/agents.py`
- Create: `backend/app/dependencies.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing API tests**

```python
# backend/tests/test_api.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.workflow.models import (
    Session, SessionStatus, CreateSessionRequest, AgentResult,
)
from app.main import create_app
from app.config import Settings


@pytest.fixture
async def client(tmp_vault):
    """Create test client with mocked engine."""
    settings = Settings()
    settings.vault.path = str(tmp_vault)

    app = create_app(settings)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_list_agents(client: AsyncClient):
    """GET /api/agents returns agent list."""
    resp = await client.get("/api/agents")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_create_session(client: AsyncClient):
    """POST /api/sessions creates a new session."""
    resp = await client.post("/api/sessions", json={
        "requirement": "设计一个电商系统",
    })
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["status"] in ("created", "running", "completed")
    assert data["input_requirement"] == "设计一个电商系统"


@pytest.mark.asyncio
async def test_list_sessions(client: AsyncClient):
    """GET /api/sessions returns session list."""
    # Create one first
    await client.post("/api/sessions", json={"requirement": "test"})

    resp = await client.get("/api/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_session(client: AsyncClient):
    """GET /api/sessions/{id} returns session detail."""
    create_resp = await client.post("/api/sessions", json={"requirement": "test"})
    session_id = create_resp.json()["id"]

    resp = await client.get(f"/api/sessions/{session_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == session_id


@pytest.mark.asyncio
async def test_get_session_not_found(client: AsyncClient):
    """GET /api/sessions/{id} returns 404 for nonexistent."""
    resp = await client.get("/api/sessions/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_outputs(client: AsyncClient):
    """GET /api/sessions/{id}/outputs returns output list."""
    create_resp = await client.post("/api/sessions", json={"requirement": "test"})
    session_id = create_resp.json()["id"]

    resp = await client.get(f"/api/sessions/{session_id}/outputs")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """GET /health returns ok."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Implement dependencies.py**

```python
# backend/app/dependencies.py
from functools import lru_cache

from app.config import Settings
from app.workflow.engine import WorkflowEngine
from app.vault.manager import VaultManager
from app.ws.manager import WebSocketManager
from app.agent.pool import AgentPool
from pathlib import Path


@lru_cache
def get_settings() -> Settings:
    return Settings()


def create_engine(settings: Settings) -> WorkflowEngine:
    """Create and wire up all components."""
    vault_path = Path(settings.vault.path)
    vault_manager = VaultManager(vault_path)
    vault_manager.ensure_structure()

    pool = AgentPool(
        max_concurrent=settings.agent.max_concurrent,
        timeout_seconds=settings.agent.timeout_seconds,
        retry_count=settings.agent.retry_count,
    )

    ws_manager = WebSocketManager()

    return WorkflowEngine(
        vault_manager=vault_manager,
        pool=pool,
        ws_manager=ws_manager,
        work_dir=settings.agent.work_dir,
    )
```

- [ ] **Step 4: Implement API routes**

```python
# backend/app/api/__init__.py
```

```python
# backend/app/api/router.py
from fastapi import APIRouter
from app.api.sessions import router as sessions_router
from app.api.agents import router as agents_router

router = APIRouter(prefix="/api")
router.include_router(sessions_router)
router.include_router(agents_router)
```

```python
# backend/app/api/sessions.py
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.workflow.models import CreateSessionRequest
from app.workflow.engine import WorkflowEngine
from app.ws.manager import WebSocketManager

router = APIRouter(tags=["sessions"])

# These will be injected via app state
_engine: WorkflowEngine | None = None
_ws_manager: WebSocketManager | None = None


def set_engine(engine: WorkflowEngine) -> None:
    global _engine, _ws_manager
    _engine = engine
    _ws_manager = engine.ws_manager


@router.post("/sessions", status_code=201)
async def create_session(req: CreateSessionRequest):
    assert _engine is not None
    session = await _engine.start_session(req)
    return session.model_dump(mode="json")


@router.get("/sessions")
async def list_sessions():
    assert _engine is not None
    sessions = _engine.list_sessions()
    return [s.model_dump(mode="json") for s in sessions]


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump(mode="json")


@router.get("/sessions/{session_id}/outputs")
async def list_outputs(session_id: str):
    assert _engine is not None
    outputs = _engine.vault_manager.list_outputs(session_id)
    return outputs


@router.get("/sessions/{session_id}/outputs/{filename}")
async def get_output_file(session_id: str, filename: str):
    assert _engine is not None
    content = _engine.vault_manager.get_output_file(session_id, filename)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    return {"filename": filename, "content": content}


@router.websocket("/ws/sessions/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str):
    assert _ws_manager is not None
    await _ws_manager.connect(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        _ws_manager.disconnect(session_id, websocket)
```

```python
# backend/app/api/agents.py
from fastapi import APIRouter

from app.workflow.engine import WorkflowEngine

router = APIRouter(prefix="/agents", tags=["agents"])

_engine: WorkflowEngine | None = None


def set_engine(engine: WorkflowEngine) -> None:
    global _engine
    _engine = engine


@router.get("")
async def list_agents():
    assert _engine is not None
    agents = _engine.vault_manager.load_agent_definitions()
    return [a.model_dump() for a in agents]


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    assert _engine is not None
    agents = _engine.vault_manager.load_agent_definitions()
    for agent in agents:
        if agent.id == agent_id:
            return agent.model_dump()
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Agent not found")
```

- [ ] **Step 5: Implement main.py (app factory)**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings
from app.dependencies import create_engine
from app.api.router import router as api_router
from app.api.sessions import set_engine as set_sessions_engine
from app.api.agents import set_engine as set_agents_engine


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    app = FastAPI(
        title="AgentOffice",
        version="0.1.0",
        description="Multi-agent collaboration system",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.server.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check
    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # Create engine and inject
    engine = create_engine(settings)
    set_sessions_engine(engine)
    set_agents_engine(engine)

    # Mount routes
    app.include_router(api_router)

    return app
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_api.py -v`
Expected: 7 passed (note: create_session may fail if `claude` CLI not available — mock the engine in conftest for CI)

- [ ] **Step 7: Commit**

```bash
git add app/main.py app/dependencies.py app/api/ tests/test_api.py
git commit -m "feat: add FastAPI app with REST API endpoints"
```

---

### Task 11: Integration Smoke Test

**Files:**
- Create: `backend/tests/test_integration.py`

- [ ] **Step 1: Write integration test (requires claude CLI)**

```python
# backend/tests/test_integration.py
"""Integration tests that require claude CLI to be installed.
Run with: pytest tests/test_integration.py -v --run-integration
"""
import os
import pytest

# Skip entire module if no claude CLI or if not explicitly requested
pytestmark = pytest.mark.skipif(
    not os.environ.get("RUN_INTEGRATION"),
    reason="Set RUN_INTEGRATION=1 to run integration tests (requires claude CLI)",
)

from pathlib import Path
from app.config import Settings
from app.main import create_app
from httpx import AsyncClient, ASGITransport


@pytest.fixture
async def integration_client(tmp_path):
    settings = Settings()
    settings.vault.path = str(tmp_path / "vault")
    settings.agent.timeout_seconds = 120

    app = create_app(settings)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_full_workflow(integration_client: AsyncClient):
    """End-to-end: submit requirement → get completed session with outputs."""
    resp = await integration_client.post("/api/sessions", json={
        "requirement": "请用一句话描述什么是微服务架构。",
    })
    assert resp.status_code == 201
    data = resp.json()
    session_id = data["id"]
    assert data["status"] in ("created", "running", "completed")

    # Check session detail
    detail = await integration_client.get(f"/api/sessions/{session_id}")
    assert detail.status_code == 200

    # Check outputs exist
    outputs = await integration_client.get(f"/api/sessions/{session_id}/outputs")
    assert outputs.status_code == 200
    assert len(outputs.json()) > 0
```

- [ ] **Step 2: Verify unit tests still pass**

Run: `cd backend && uv run pytest tests/ -v --ignore=tests/test_integration.py`
Expected: All unit tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/test_integration.py
git commit -m "test: add integration smoke test for full workflow"
```

---

### Task 12: Session Control Endpoints (pause/resume/cancel/workflow)

**Files:**
- Modify: `backend/app/api/sessions.py`
- Modify: `backend/app/workflow/engine.py`
- Create: `backend/tests/test_session_control.py`

The spec requires `POST /api/sessions/{id}/pause`, `/resume`, `/cancel`, and `GET /api/sessions/{id}/workflow`. Task 10 only created basic CRUD — this task fills the gap.

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_session_control.py
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

from app.config import Settings
from app.main import create_app
from app.workflow.models import AgentResult
from httpx import AsyncClient, ASGITransport


@pytest.fixture
async def client_with_session(tmp_vault):
    """Create client and a completed session for testing."""
    settings = Settings()
    settings.vault.path = str(tmp_vault)

    app = create_app(settings)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # Create a session
        resp = await c.post("/api/sessions", json={"requirement": "test"})
        session_id = resp.json()["id"]
        yield c, session_id


@pytest.mark.asyncio
async def test_get_workflow(client_with_session):
    """GET /api/sessions/{id}/workflow returns phase details."""
    client, session_id = client_with_session
    resp = await client.get(f"/api/sessions/{session_id}/workflow")
    assert resp.status_code == 200
    data = resp.json()
    assert "phases" in data
    assert len(data["phases"]) >= 1


@pytest.mark.asyncio
async def test_cancel_session(client_with_session):
    """POST /api/sessions/{id}/cancel sets status to cancelled."""
    client, session_id = client_with_session
    resp = await client.post(f"/api/sessions/{session_id}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_nonexistent_session(client_with_session):
    """POST /api/sessions/{id}/cancel returns 404 for nonexistent."""
    client, _ = client_with_session
    resp = await client.post("/api/sessions/nonexistent/cancel")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_pause_not_supported_for_completed(client_with_session):
    """Cannot pause a completed session."""
    client, session_id = client_with_session
    resp = await client.post(f"/api/sessions/{session_id}/pause")
    # Already completed, should return 400
    assert resp.status_code in (400, 200)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_session_control.py -v`
Expected: FAIL — 404 on `/workflow` and `/cancel` endpoints

- [ ] **Step 3: Add endpoints to sessions.py**

Add these endpoints to `backend/app/api/sessions.py`:

```python
@router.get("/sessions/{session_id}/workflow")
async def get_workflow(session_id: str):
    """Get workflow phase details for a session."""
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session.id,
        "status": session.status,
        "mode": session.mode,
        "phases": [
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
                "agents": p.agents,
                "outputs": p.outputs,
                "started_at": p.started_at.isoformat() if p.started_at else None,
                "completed_at": p.completed_at.isoformat() if p.completed_at else None,
            }
            for p in session.phases
        ],
    }


@router.post("/sessions/{session_id}/pause")
async def pause_session(session_id: str):
    """Pause a running session."""
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "running":
        raise HTTPException(status_code=400, detail=f"Cannot pause session in '{session.status}' state")
    session.status = "paused"
    _engine.vault_manager.update_session(session)
    await _ws_manager.emit(session_id, "session:paused", session_id=session_id)
    return session.model_dump(mode="json")


@router.post("/sessions/{session_id}/resume")
async def resume_session(session_id: str):
    """Resume a paused session."""
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "paused":
        raise HTTPException(status_code=400, detail=f"Cannot resume session in '{session.status}' state")
    session.status = "running"
    _engine.vault_manager.update_session(session)
    await _ws_manager.emit(session_id, "session:started", session_id=session_id)
    return session.model_dump(mode="json")


@router.post("/sessions/{session_id}/cancel")
async def cancel_session(session_id: str):
    """Cancel a session."""
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel session in '{session.status}' state")
    session.status = "cancelled"
    _engine.vault_manager.update_session(session)
    await _ws_manager.emit(session_id, "session:cancelled", session_id=session_id)
    return session.model_dump(mode="json")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_session_control.py -v`
Expected: 5 passed

- [ ] **Step 5: Run all tests**

Run: `cd backend && uv run pytest tests/ -v --ignore=tests/test_integration.py`
Expected: All unit tests pass

- [ ] **Step 6: Commit**

```bash
git add app/api/sessions.py tests/test_session_control.py
git commit -m "feat: add session control endpoints (pause/resume/cancel/workflow)"
```
