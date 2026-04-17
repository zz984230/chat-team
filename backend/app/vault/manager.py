# backend/app/vault/manager.py
from datetime import datetime
from pathlib import Path
import shutil

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
            data = yaml.safe_load(f.read_text(encoding="utf-8"))
            if data:
                agents.append(AgentDefinition(**data))
        return agents

    def create_session(self, session: Session) -> Path:
        """Create session directory with input file and meta.yaml."""
        session_dir = self._sessions_path / session.id
        session_dir.mkdir(parents=True, exist_ok=True)

        # Write input requirement
        (session_dir / "00-原始需求.md").write_text(session.input_requirement, encoding="utf-8")

        # Write meta.yaml
        self._write_meta(session_dir, session)

        return session_dir

    def get_session(self, session_id: str) -> Session | None:
        """Read session from meta.yaml. Returns None if not found."""
        meta_path = self._sessions_path / session_id / "meta.yaml"
        if not meta_path.exists():
            return None
        data = yaml.safe_load(meta_path.read_text(encoding="utf-8"))
        return Session(**data) if data else None

    def list_sessions(self) -> list[Session]:
        """List all sessions sorted by created_at descending."""
        sessions = []
        if not self._sessions_path.exists():
            return sessions
        for meta_path in self._sessions_path.glob("*/meta.yaml"):
            data = yaml.safe_load(meta_path.read_text(encoding="utf-8"))
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
        output_path.write_text(content, encoding="utf-8")

    def get_output_file(self, session_id: str, filename: str) -> str | None:
        """Read an output file from session directory."""
        path = self._sessions_path / session_id / filename
        if not path.exists():
            return None
        return path.read_text(encoding="utf-8")

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

    def delete_session(self, session_id: str) -> bool:
        """Delete session directory and all contents."""
        session_dir = self._sessions_path / session_id
        if not session_dir.exists():
            return False
        shutil.rmtree(session_dir)
        return True

    def _write_meta(self, session_dir: Path, session: Session) -> None:
        """Serialize session to meta.yaml."""
        meta_path = session_dir / "meta.yaml"
        meta_path.write_text(
            yaml.dump(session.model_dump(mode="json"), allow_unicode=True, default_flow_style=False),
            encoding="utf-8",
        )
