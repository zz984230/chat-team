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
    api_key: str = ""
    api_base_url: str = ""
    allowed_tools: list[str] = []


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
