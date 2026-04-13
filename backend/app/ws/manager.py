import asyncio
from typing import Any

from fastapi import WebSocket


class WebSocketManager:
    """Manages WebSocket connections and broadcasts events to session subscribers."""

    def __init__(self):
        # session_id -> set of WebSocket connections
        self.connections: dict[str, set[WebSocket]] = {}

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        """Accept and register a WebSocket connection for a session."""
        await ws.accept()
        if session_id not in self.connections:
            self.connections[session_id] = set()
        self.connections[session_id].add(ws)

    def disconnect(self, session_id: str, ws: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if session_id in self.connections:
            self.connections[session_id].discard(ws)
            if not self.connections[session_id]:
                del self.connections[session_id]

    async def broadcast(self, session_id: str, event: dict[str, Any]) -> None:
        """Send an event to all connections subscribed to a session."""
        if session_id not in self.connections:
            return

        dead: list[WebSocket] = []
        for ws in self.connections[session_id]:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(session_id, ws)

    async def emit(self, session_id: str, event_type: str, **kwargs: Any) -> None:
        """Convenience method to broadcast a typed event."""
        event = {"type": event_type, **kwargs}
        await self.broadcast(session_id, event)
