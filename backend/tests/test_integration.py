# backend/tests/test_integration.py
"""Integration tests that require claude CLI to be installed.
Run with: RUN_INTEGRATION=1 uv run pytest tests/test_integration.py -v
"""
import os
import pytest

# Skip entire module if not explicitly requested
pytestmark = pytest.mark.skipif(
    not os.environ.get("RUN_INTEGRATION"),
    reason="Set RUN_INTEGRATION=1 to run integration tests (requires claude CLI)",
)

from pathlib import Path

import yaml
from httpx import AsyncClient, ASGITransport

from app.config import Settings
from app.main import create_app


def _create_agent_yamls(agents_dir: Path) -> None:
    """Create agent YAML definitions so the engine can load them."""
    agents = [
        {
            "id": "analyst",
            "name": "需求分析师",
            "system_prompt": "You are a requirements analyst.",
        },
        {
            "id": "architect",
            "name": "架构师",
            "system_prompt": "You are a software architect.",
        },
        {
            "name": "研究员",
            "system_prompt": "You are a researcher.",
        },
        {
            "id": "writer",
            "name": "整合输出师",
            "system_prompt": "You are a technical writer.",
        },
    ]
    agents_dir.mkdir(parents=True, exist_ok=True)
    for agent in agents:
        path = agents_dir / f"{agent['id']}.yaml"
        path.write_text(yaml.dump(agent, allow_unicode=True), encoding="utf-8")


@pytest.fixture
async def integration_client(tmp_path: Path):
    vault_path = tmp_path / "vault"
    _create_agent_yamls(vault_path / "agents")

    settings = Settings()
    settings.vault.path = str(vault_path)
    settings.agent.timeout_seconds = 120

    app = create_app(settings)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_full_workflow(integration_client: AsyncClient):
    """End-to-end: submit requirement -> get completed session with outputs."""
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
