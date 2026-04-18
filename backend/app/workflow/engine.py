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
        api_key: str = "",
        api_base_url: str = "",
        allowed_tools: list[str] = [],
    ):
        self.vault_manager = vault_manager
        self.pool = pool
        self.ws_manager = ws_manager
        self.work_dir = work_dir
        self.api_key = api_key
        self.api_base_url = api_base_url
        self.allowed_tools = allowed_tools
        self._agent_defs: dict[str, AgentDefinition] = {}
        self._sessions: dict[str, Session] = {}
        self._load_agent_defs()

    @staticmethod
    def _add_outputs(phase: Any, new_files: list[str]) -> list[str]:
        """Extend phase.outputs with deduplication. Returns only the actually new files."""
        added = [f for f in new_files if f not in phase.outputs]
        phase.outputs.extend(added)
        return added

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

    def create_session(self, req: CreateSessionRequest) -> Session:
        """Create a new session (sync, returns immediately)."""
        room_agents = [a.id for a in self.vault_manager.load_agents_by_room(req.room)]
        if not room_agents:
            raise ValueError(f"No agents found for room '{req.room}'")
        session_id = self._generate_session_id()
        session = Session.from_request(req, session_id, room_agents=room_agents)
        session.status = SessionStatus.RUNNING
        session.updated_at = datetime.now()
        self._sessions[session_id] = session
        self.vault_manager.create_session(session)
        self.vault_manager.update_session(session)
        return session

    async def execute_session(self, session: Session) -> Session:
        """Execute a previously created session (async, runs in background)."""
        session_id = session.id
        await self.ws_manager.emit(session_id, "session:started")

        try:
            if session.mode == SessionMode.DEFAULT:
                await self._run_default_workflow(session)
            else:
                await self._run_brainstorm_workflow(session)

            session.status = SessionStatus.COMPLETED
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Session %s failed", session_id)
            session.status = SessionStatus.FAILED
            await self.ws_manager.emit(session_id, "session:failed", error=str(e))
        finally:
            session.updated_at = datetime.now()
            self.vault_manager.update_session(session)
            await self.ws_manager.emit(session_id, "session:completed")

        return session

    async def _run_default_workflow(self, session: Session) -> None:
        """Run the default 4-phase workflow."""
        session_dir = self.vault_manager._sessions_path / session.id

        # Phase 1: analyst
        phase = session.phases[0]
        await self._run_phase(session, phase, "请分析以下需求并输出需求澄清文档。", session_dir)

        # Phase 2: architect
        phase = session.phases[1]
        await self._run_phase(session, phase, "请基于需求分析设计技术方案。", session_dir)

        # Phase 3: dev-lead
        phase = session.phases[2]
        await self._run_phase(session, phase, "请阅读所有前置文档，将技术方案分解为开发任务。", session_dir)

        # Phase 4: test-lead
        phase = session.phases[3]
        await self._run_phase(session, phase, "请阅读所有前置文档，制定测试计划。", session_dir)

    async def _run_brainstorm_workflow(self, session: Session) -> None:
        """Run brainstorm mode: all room agents discuss in rounds."""
        from app.workflow.models import DiscussionState, DiscussionTurn

        session_dir = self.vault_manager._sessions_path / session.id
        phase = session.phases[0]
        phase.status = PhaseStatus.RUNNING
        phase.started_at = datetime.now()
        self.vault_manager.update_session(session)
        await self.ws_manager.emit(session.id, "phase:started", phase=phase.id)

        state = DiscussionState(rounds_total=session.config_rounds)

        for round_num in range(1, state.rounds_total + 1):
            state.current_round = round_num

            for agent_id in phase.agents:
                content = await self._run_agent_turn(session, state, agent_id, session_dir)
                turn = DiscussionTurn(round=round_num, agent_id=agent_id, content=content)
                state.turns.append(turn)

        # Write combined discussion log
        log_path = session_dir / "01-讨论记录.md"
        lines = [f"# 讨论记录\n\n## 原始需求\n{session.input_requirement}\n"]
        for t in state.turns:
            lines.append(f"\n## {t.agent_id}（第{t.round}轮）\n\n{t.content}\n")
        log_path.write_text("\n".join(lines), encoding="utf-8")

        added = self._add_outputs(phase, ["01-讨论记录.md"])
        phase.status = PhaseStatus.COMPLETED
        phase.completed_at = datetime.now()
        self.vault_manager.update_session(session)
        await self.ws_manager.emit(session.id, "phase:completed", phase=phase.id, outputs=added)

    async def _run_agent_turn(
        self, session: Session, state: "DiscussionState",
        agent_id: str, session_dir: Path,
    ) -> str:
        """Run a single agent turn and return the spoken content."""
        agent_def = self._get_agent_def(agent_id)

        turns_summary = ""
        if state.turns:
            turns_summary = "\n\n## 已有发言记录\n"
            for t in state.turns:
                turns_summary += f"\n### {t.agent_id}（第{t.round}轮）\n{t.content}\n"

        task = (
            f"## 讨论主题\n{session.input_requirement}\n"
            f"{turns_summary}\n\n"
            f"请以你的角色身份发表观点。"
        )

        config = AgentRunConfig(
            work_dir=Path(f"{self.work_dir}/{session.id}/{agent_id}"),
            session_dir=session_dir,
            input_files=[],
            api_key=self.api_key,
            api_base_url=self.api_base_url,
            allowed_tools=self.allowed_tools,
            use_casual=True,
        )
        runner = AgentRunner(agent_def, config)

        try:
            await runner.prepare()
            events = await runner.execute(task)

            final = next(
                (e for e in reversed(events) if e.type == "completed" and e.content),
                None,
            )
            return final.content if final else ""
        finally:
            await runner.cleanup()

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
            api_key=self.api_key,
            api_base_url=self.api_base_url,
            allowed_tools=self.allowed_tools,
        )
        runner = AgentRunner(agent_def, config)

        result = await self.pool.submit(runner, task)

        added = self._add_outputs(phase, result.output_files)
        phase.status = PhaseStatus.COMPLETED if result.success else PhaseStatus.FAILED
        phase.completed_at = datetime.now()
        self.vault_manager.update_session(session)

        await self.ws_manager.emit(
            session.id, "phase:completed", phase=phase.id, outputs=added,
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
                api_key=self.api_key,
                api_base_url=self.api_base_url,
                allowed_tools=self.allowed_tools,
            )
            runner = AgentRunner(agent_def, config)
            return await self.pool.submit(runner, task)

        results = await asyncio.gather(
            *[run_single(aid) for aid in phase.agents],
            return_exceptions=True,
        )

        added: list[str] = []
        success_count = 0
        for r in results:
            if isinstance(r, AgentResult):
                added.extend(self._add_outputs(phase, r.output_files))
                if r.success:
                    success_count += 1

        if success_count == 0:
            errors = [str(r) for r in results if isinstance(r, Exception)]
            phase.status = PhaseStatus.FAILED
        else:
            phase.status = PhaseStatus.COMPLETED
        phase.completed_at = datetime.now()
        self.vault_manager.update_session(session)

        await self.ws_manager.emit(
            session.id, "phase:completed", phase=phase.id, outputs=added,
        )

    def get_session(self, session_id: str) -> Session | None:
        """Get session by ID (prefers in-memory for live state)."""
        return self._sessions.get(session_id) or self.vault_manager.get_session(session_id)


    def remove_session(self, session_id: str) -> None:
        """Remove session from in-memory cache."""
        self._sessions.pop(session_id, None)

    def list_sessions(self) -> list[Session]:
        """List all sessions (merges in-memory and vault)."""
        vault_sessions = {s.id: s for s in self.vault_manager.list_sessions()}
        vault_sessions.update(self._sessions)
        return list(vault_sessions.values())
