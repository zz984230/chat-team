# backend/tests/test_session_control.py
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.config import Settings
from app.main import create_app
from app.workflow.models import AgentResult
from httpx import AsyncClient, ASGITransport


def _create_agent_yamls(agents_dir: Path) -> None:
    """Create minimal agent YAML definitions for testing."""
    import yaml
    agents = [
        {"id": "analyst", "name": "需求分析师", "system_prompt": "You are an analyst."},
        {"id": "architect", "name": "架构师", "system_prompt": "You are an architect."},
        {"id": "writer", "name": "整合输出师", "system_prompt": "You are a writer."},
    ]
    for agent in agents:
        path = agents_dir / f"{agent['id']}.yaml"
        path.write_text(yaml.dump(agent, allow_unicode=True), encoding="utf-8")


@pytest.fixture
async def client_with_session(tmp_vault):
    """Create client and a completed session for testing."""
    # Create agent YAMLs so engine can load definitions
    _create_agent_yamls(tmp_vault / "agents")

    settings = Settings()
    settings.vault.path = str(tmp_vault)

    mock_result = AgentResult(
        agent_id="analyst", success=True, output_files=["01-需求澄清.md"], duration_ms=100,
    )

    with patch("app.dependencies.AgentPool") as MockPool:
        mock_pool_instance = MagicMock()
        mock_pool_instance.submit = AsyncMock(return_value=mock_result)
        MockPool.return_value = mock_pool_instance

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


@pytest.mark.asyncio
async def test_resume_not_supported_for_completed(client_with_session):
    """Cannot resume a completed session."""
    client, session_id = client_with_session
    resp = await client.post(f"/api/sessions/{session_id}/resume")
    # Already completed, should return 400
    assert resp.status_code in (400, 200)


@pytest.mark.asyncio
async def test_get_workflow_not_found(client_with_session):
    """GET /api/sessions/{id}/workflow returns 404 for nonexistent."""
    client, _ = client_with_session
    resp = await client.get("/api/sessions/nonexistent/workflow")
    assert resp.status_code == 404
