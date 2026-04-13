# backend/app/api/sessions.py
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.workflow.models import CreateSessionRequest
from app.workflow.engine import WorkflowEngine
from app.ws.manager import WebSocketManager

router = APIRouter(tags=["sessions"])

# These will be injected via app state
_engine: WorkflowEngine | None = None
_ws_manager: WebSocketManager | None = None


def set_engine(engine: WorkflowEngine) -> None:
    global _engine, _ws_manager
    _engine = engine
    _ws_manager = engine.ws_manager


@router.post("/sessions", status_code=201)
async def create_session(req: CreateSessionRequest):
    assert _engine is not None
    session = await _engine.start_session(req)
    return session.model_dump(mode="json")


@router.get("/sessions")
async def list_sessions():
    assert _engine is not None
    sessions = _engine.list_sessions()
    return [s.model_dump(mode="json") for s in sessions]


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump(mode="json")


@router.get("/sessions/{session_id}/outputs")
async def list_outputs(session_id: str):
    assert _engine is not None
    outputs = _engine.vault_manager.list_outputs(session_id)
    return outputs


@router.get("/sessions/{session_id}/outputs/{filename}")
async def get_output_file(session_id: str, filename: str):
    assert _engine is not None
    content = _engine.vault_manager.get_output_file(session_id, filename)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    return {"filename": filename, "content": content}


@router.websocket("/ws/sessions/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str):
    assert _ws_manager is not None
    await _ws_manager.connect(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        _ws_manager.disconnect(session_id, websocket)
