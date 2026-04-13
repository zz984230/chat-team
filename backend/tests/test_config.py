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
