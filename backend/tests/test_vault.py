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
        "output_file: 01-需求澄清.md\n",
        encoding="utf-8",
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
        CreateSessionRequest(requirement="设计电商系统", room="rd"),
        "20260413-153000-abc",
    )
    session_dir = vm.create_session(session)
    assert session_dir.is_dir()
    assert (session_dir / "00-原始需求.md").exists()
    assert "设计电商系统" in (session_dir / "00-原始需求.md").read_text(encoding="utf-8")
    assert (session_dir / "meta.yaml").exists()


def test_get_session(tmp_vault: Path):
    """get_session reads meta.yaml and returns Session model."""
    vm = VaultManager(tmp_vault)
    req = CreateSessionRequest(requirement="test", room="rd")
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
            CreateSessionRequest(requirement=f"test-{i}", room="rd"),
            f"session-{i}",
        )
        vm.create_session(session)

    sessions = vm.list_sessions()
    assert len(sessions) == 3


def test_update_session(tmp_vault: Path):
    """update_session writes updated meta.yaml."""
    vm = VaultManager(tmp_vault)
    session = Session.from_request(
        CreateSessionRequest(requirement="test", room="rd"),
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
        CreateSessionRequest(requirement="test", room="rd"),
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
        CreateSessionRequest(requirement="test", room="rd"),
        "20260413-153000-abc",
    )
    vm.create_session(session)
    vm.save_agent_output("20260413-153000-abc", "01-需求澄清.md", "content1")
    vm.save_agent_output("20260413-153000-abc", "02-技术方案.md", "content2")

    outputs = vm.list_outputs("20260413-153000-abc")
    assert "01-需求澄清.md" in outputs
    assert "02-技术方案.md" in outputs


def test_delete_session(tmp_vault: Path):
    """delete_session removes session directory entirely."""
    vm = VaultManager(tmp_vault)
    session = Session.from_request(
        CreateSessionRequest(requirement="test", room="rd"),
        "20260413-153000-abc",
    )
    vm.create_session(session)

    result = vm.delete_session("20260413-153000-abc")
    assert result is True
    assert not (tmp_vault / "sessions" / "20260413-153000-abc").exists()


def test_delete_session_not_found(tmp_vault: Path):
    """delete_session returns False for nonexistent session."""
    vm = VaultManager(tmp_vault)
    result = vm.delete_session("nonexistent")
    assert result is False


def test_delete_session_removes_from_list(tmp_vault: Path):
    """delete_session removes session from list_sessions results."""
    vm = VaultManager(tmp_vault)
    session = Session.from_request(
        CreateSessionRequest(requirement="test", room="rd"),
        "20260413-153000-abc",
    )
    vm.create_session(session)

    assert len(vm.list_sessions()) == 1
    vm.delete_session("20260413-153000-abc")
    assert len(vm.list_sessions()) == 0


def test_load_agents_by_room(tmp_vault):
    """load_agents_by_room returns only agents matching the room."""
    from app.vault.manager import VaultManager

    agents_dir = tmp_vault / "agents"
    agents_dir.mkdir(exist_ok=True)

    agents = [
        {"id": "analyst", "name": "分析师", "room": "rd", "system_prompt": "analyze"},
        {"id": "architect", "name": "架构师", "room": "rd", "system_prompt": "design"},
        {"id": "marketer", "name": "市场", "room": "marketing", "system_prompt": "market"},
    ]
    for agent in agents:
        path = agents_dir / f"{agent['id']}.yaml"
        path.write_text(yaml.dump(agent, allow_unicode=True), encoding="utf-8")

    vm = VaultManager(tmp_vault)
    rd_agents = vm.load_agents_by_room("rd")
    assert len(rd_agents) == 2
    assert all(a.room == "rd" for a in rd_agents)

    marketing_agents = vm.load_agents_by_room("marketing")
    assert len(marketing_agents) == 1

    empty = vm.load_agents_by_room("nonexistent")
    assert len(empty) == 0
