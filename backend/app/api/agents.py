# backend/app/api/agents.py
from fastapi import APIRouter, HTTPException

from app.workflow.engine import WorkflowEngine

router = APIRouter(prefix="/agents", tags=["agents"])

_engine: WorkflowEngine | None = None


def set_engine(engine: WorkflowEngine) -> None:
    global _engine
    _engine = engine


@router.get("")
async def list_agents():
    assert _engine is not None
    agents = _engine.vault_manager.load_agent_definitions()
    return [a.model_dump() for a in agents]


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    assert _engine is not None
    agents = _engine.vault_manager.load_agent_definitions()
    for agent in agents:
        if agent.id == agent_id:
            return agent.model_dump()
    raise HTTPException(status_code=404, detail="Agent not found")
