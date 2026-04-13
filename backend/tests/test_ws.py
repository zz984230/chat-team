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
