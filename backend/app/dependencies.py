# backend/app/dependencies.py
from functools import lru_cache
from pathlib import Path

from app.config import Settings
from app.workflow.engine import WorkflowEngine
from app.vault.manager import VaultManager
from app.ws.manager import WebSocketManager
from app.agent.pool import AgentPool


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
