# backend/app/api/router.py
from fastapi import APIRouter
from app.api.sessions import router as sessions_router
from app.api.agents import router as agents_router

router = APIRouter(prefix="/api")
router.include_router(sessions_router)
router.include_router(agents_router)
