# backend/app/api/sessions.py
import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.workflow.models import CreateSessionRequest, SessionStatus
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
    session = _engine.create_session(req)
    asyncio.create_task(_engine.execute_session(session))
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


@router.get("/sessions/{session_id}/workflow")
async def get_workflow(session_id: str):
    """Get workflow phase details for a session."""
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session.id,
        "status": session.status,
        "mode": session.mode,
        "phases": [
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
                "agents": p.agents,
                "outputs": p.outputs,
                "started_at": p.started_at.isoformat() if p.started_at else None,
                "completed_at": p.completed_at.isoformat() if p.completed_at else None,
            }
            for p in session.phases
        ],
    }


@router.post("/sessions/{session_id}/pause")
async def pause_session(session_id: str):
    """Pause a running session."""
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "running":
        raise HTTPException(status_code=400, detail=f"Cannot pause session in '{session.status}' state")
    session.status = SessionStatus.PAUSED
    _engine.vault_manager.update_session(session)
    await _ws_manager.emit(session_id, "session:paused")
    return session.model_dump(mode="json")


@router.post("/sessions/{session_id}/resume")
async def resume_session(session_id: str):
    """Resume a paused session."""
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "paused":
        raise HTTPException(status_code=400, detail=f"Cannot resume session in '{session.status}' state")
    session.status = SessionStatus.RUNNING
    _engine.vault_manager.update_session(session)
    await _ws_manager.emit(session_id, "session:started")
    return session.model_dump(mode="json")


@router.post("/sessions/{session_id}/cancel")
async def cancel_session(session_id: str):
    """Cancel a session."""
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == SessionStatus.CANCELLED:
        raise HTTPException(status_code=400, detail=f"Cannot cancel session in '{session.status}' state")
    session.status = SessionStatus.CANCELLED
    _engine.vault_manager.update_session(session)
    await _ws_manager.emit(session_id, "session:cancelled")
    return session.model_dump(mode="json")


@router.websocket("/ws/sessions/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str):
    assert _ws_manager is not None
    await _ws_manager.connect(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        _ws_manager.disconnect(session_id, websocket)
