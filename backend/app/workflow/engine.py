import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any

from app.agent.pool import AgentPool
from app.agent.runner import AgentRunner, AgentRunConfig
from app.vault.manager import VaultManager
from app.ws.manager import WebSocketManager
from app.workflow.models import (
    Session, SessionStatus, PhaseStatus, SessionMode,
    CreateSessionRequest, AgentDefinition, AgentResult,
)


class WorkflowEngine:
    """Orchestrates multi-agent workflows."""

    def __init__(
        self,
        vault_manager: VaultManager,
        pool: AgentPool,
        ws_manager: WebSocketManager,
        work_dir: str = "/tmp/agentoffice",
    ):
        self.vault_manager = vault_manager
        self.pool = pool
        self.ws_manager = ws_manager
        self.work_dir = work_dir
        self._agent_defs: dict[str, AgentDefinition] = {}
        self._load_agent_defs()

    def _load_agent_defs(self) -> None:
        """Load agent definitions from vault."""
        for agent in self.vault_manager.load_agent_definitions():
            self._agent_defs[agent.id] = agent

    def _get_agent_def(self, agent_id: str) -> AgentDefinition:
        """Get agent definition by ID. Raises KeyError if not found."""
        if agent_id not in self._agent_defs:
            raise KeyError(f"Agent definition not found: {agent_id}")
        return self._agent_defs[agent_id]

    def _generate_session_id(self) -> str:
        """Generate a unique session ID based on timestamp and counter."""
        import uuid
        return datetime.now().strftime("%Y%m%d-%H%M%S") + f"-{uuid.uuid4().hex[:6]}"

    async def start_session(self, req: CreateSessionRequest) -> Session:
        """Create and execute a new workflow session."""
        session_id = self._generate_session_id()
        session = Session.from_request(req, session_id)
        session.status = SessionStatus.RUNNING
        session.updated_at = datetime.now()

        # Create session in vault
        self.vault_manager.create_session(session)
        self.vault_manager.update_session(session)

        # Notify
        await self.ws_manager.emit(session_id, "session:started")

        try:
            if session.mode == SessionMode.DEFAULT:
                await self._run_default_workflow(session)
            else:
                await self._run_brainstorm_workflow(session)

            session.status = SessionStatus.COMPLETED
        except Exception as e:
            session.status = SessionStatus.FAILED
            await self.ws_manager.emit(session_id, "session:failed", error=str(e))
        finally:
            session.updated_at = datetime.now()
            self.vault_manager.update_session(session)
            await self.ws_manager.emit(session_id, "session:completed")

        return session

    async def _run_default_workflow(self, session: Session) -> None:
        """Run the default 3-phase workflow."""
        session_dir = self.vault_manager._sessions_path / session.id

        # Phase 1: analyst (sequential)
        phase = session.phases[0]
        await self._run_phase(session, phase, "请分析以下需求并输出需求澄清文档。", session_dir)

        # Phase 2: architect + researcher (parallel)
        phase = session.phases[1]
        await self._run_parallel_phase(session, phase, session_dir)

        # Phase 3: writer (sequential)
        phase = session.phases[2]
        task = "请阅读所有前置文档，整合输出最终方案。"
        await self._run_phase(session, phase, task, session_dir)

    async def _run_brainstorm_workflow(self, session: Session) -> None:
        """Run brainstorm mode with multiple rounds."""
        session_dir = self.vault_manager._sessions_path / session.id
        rounds = 3  # default

        # Multi-round brainstorm
        phase = session.phases[0]
        for round_num in range(1, rounds + 1):
            await self._run_parallel_phase(
                session, phase, session_dir,
                task_prefix=f"第 {round_num}/{rounds} 轮讨论。请基于已有信息提出你的观点。",
            )

        # Final synthesis
        phase = session.phases[1]
        await self._run_phase(
            session, phase,
            "请阅读所有讨论内容，汇总输出综合报告。",
            session_dir,
        )

    async def _run_phase(
        self, session: Session, phase: Any, task: str, session_dir: Path,
    ) -> None:
        """Run a single-agent phase."""
        phase.status = PhaseStatus.RUNNING
        phase.started_at = datetime.now()
        self.vault_manager.update_session(session)

        await self.ws_manager.emit(session.id, "phase:started", phase=phase.id)

        agent_id = phase.agents[0]
        agent_def = self._get_agent_def(agent_id)
        config = AgentRunConfig(
            work_dir=Path(f"{self.work_dir}/{session.id}/{agent_id}"),
            session_dir=session_dir,
            input_files=list(session_dir.glob("*.md")),
        )
        runner = AgentRunner(agent_def, config)

        result = await self.pool.submit(runner, task)

        phase.outputs.extend(result.output_files)
        phase.status = PhaseStatus.COMPLETED if result.success else PhaseStatus.FAILED
        phase.completed_at = datetime.now()
        self.vault_manager.update_session(session)

        await self.ws_manager.emit(
            session.id, "phase:completed", phase=phase.id, outputs=result.output_files,
        )

    async def _run_parallel_phase(
        self, session: Session, phase: Any, session_dir: Path, task_prefix: str = "",
    ) -> None:
        """Run multiple agents in parallel within a phase."""
        phase.status = PhaseStatus.RUNNING
        phase.started_at = datetime.now()
        self.vault_manager.update_session(session)

        await self.ws_manager.emit(session.id, "phase:started", phase=phase.id)

        task = task_prefix or "请基于已有信息进行分析。"

        async def run_single(agent_id: str) -> AgentResult:
            agent_def = self._get_agent_def(agent_id)
            config = AgentRunConfig(
                work_dir=Path(f"{self.work_dir}/{session.id}/{agent_id}"),
                session_dir=session_dir,
                input_files=list(session_dir.glob("*.md")),
            )
            runner = AgentRunner(agent_def, config)
            return await self.pool.submit(runner, task)

        results = await asyncio.gather(
            *[run_single(aid) for aid in phase.agents],
            return_exceptions=True,
        )

        for r in results:
            if isinstance(r, AgentResult):
                phase.outputs.extend(r.output_files)

        phase.status = PhaseStatus.COMPLETED
        phase.completed_at = datetime.now()
        self.vault_manager.update_session(session)

        await self.ws_manager.emit(
            session.id, "phase:completed", phase=phase.id, outputs=phase.outputs,
        )

    def get_session(self, session_id: str) -> Session | None:
        """Get session by ID."""
        return self.vault_manager.get_session(session_id)

    def list_sessions(self) -> list[Session]:
        """List all sessions."""
        return self.vault_manager.list_sessions()
