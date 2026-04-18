# backend/tests/test_api.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.workflow.models import (
    Session, SessionStatus, CreateSessionRequest, AgentResult,
)
from app.main import create_app
from app.config import Settings


def _create_agent_yamls(agents_dir) -> None:
    """Create minimal agent YAML definitions for testing."""
    import yaml
    agents = [
        {"id": "analyst", "name": "需求分析师", "system_prompt": "You are an analyst."},
        {"id": "architect", "name": "架构师", "system_prompt": "You are an architect."},
        {"id": "dev-lead", "name": "开发负责人", "system_prompt": "You are a dev lead."},
        {"id": "test-lead", "name": "测试负责人", "system_prompt": "You are a test lead."},
    ]
    for agent in agents:
        path = agents_dir / f"{agent['id']}.yaml"
        path.write_text(yaml.dump(agent, allow_unicode=True), encoding="utf-8")


@pytest.fixture
async def client(tmp_vault):
    """Create test client with mocked engine."""
    # Create agent YAMLs in vault so engine can load definitions
    _create_agent_yamls(tmp_vault / "agents")

    settings = Settings()
    settings.vault.path = str(tmp_vault)

    # Patch pool.submit before the engine is created so it uses our mock
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


@pytest.mark.asyncio
async def test_delete_session(client: AsyncClient):
    """DELETE /api/sessions/{id} removes a completed session."""
    create_resp = await client.post("/api/sessions", json={"requirement": "to delete"})
    session_id = create_resp.json()["id"]

    # Set status to COMPLETED so deletion is allowed
    from app.api.sessions import _engine
    assert _engine is not None
    session = _engine.get_session(session_id)
    session.status = SessionStatus.COMPLETED
    _engine.vault_manager.update_session(session)

    resp = await client.delete(f"/api/sessions/{session_id}")
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(f"/api/sessions/{session_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_session_not_found(client: AsyncClient):
    """DELETE /api/sessions/{id} returns 404 for nonexistent."""
    resp = await client.delete("/api/sessions/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_running_session_conflict(client: AsyncClient):
    """DELETE /api/sessions/{id} returns 409 for running session."""
    create_resp = await client.post("/api/sessions", json={"requirement": "running"})
    session_id = create_resp.json()["id"]

    from app.api.sessions import _engine
    assert _engine is not None
    session = _engine.get_session(session_id)
    session.status = SessionStatus.RUNNING
    _engine.vault_manager.update_session(session)

    resp = await client.delete(f"/api/sessions/{session_id}")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_paused_session_conflict(client: AsyncClient):
    """DELETE /api/sessions/{id} returns 409 for paused session."""
    create_resp = await client.post("/api/sessions", json={"requirement": "paused"})
    session_id = create_resp.json()["id"]

    from app.api.sessions import _engine
    assert _engine is not None
    session = _engine.get_session(session_id)
    session.status = SessionStatus.PAUSED
    _engine.vault_manager.update_session(session)

    resp = await client.delete(f"/api/sessions/{session_id}")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_failed_session(client: AsyncClient):
    """DELETE /api/sessions/{id} succeeds for failed session."""
    create_resp = await client.post("/api/sessions", json={"requirement": "failed"})
    session_id = create_resp.json()["id"]

    from app.api.sessions import _engine
    assert _engine is not None
    session = _engine.get_session(session_id)
    session.status = SessionStatus.FAILED
    _engine.vault_manager.update_session(session)

    resp = await client.delete(f"/api/sessions/{session_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_session_invalid_id(client: AsyncClient):
    """DELETE /api/sessions/{id} returns 400 for invalid session ID with backslash."""
    resp = await client.request("DELETE", "/api/sessions/foo%5Cbar")
    assert resp.status_code == 400
