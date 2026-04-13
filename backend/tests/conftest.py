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
