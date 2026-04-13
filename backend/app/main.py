# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings
from app.dependencies import create_engine
from app.api.router import router as api_router
from app.api.sessions import set_engine as set_sessions_engine
from app.api.agents import set_engine as set_agents_engine


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    app = FastAPI(
        title="AgentOffice",
        version="0.1.0",
        description="Multi-agent collaboration system",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.server.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check
    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # Create engine and inject
    engine = create_engine(settings)
    set_sessions_engine(engine)
    set_agents_engine(engine)

    # Mount routes
    app.include_router(api_router)

    return app
