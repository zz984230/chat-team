import asyncio
import subprocess
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

    async def _classify_input(self, requirement: str) -> bool:
        """Classify input as complex (True) or simple (False).

        Uses claude CLI with haiku model for fast, cheap classification.
        Defaults to True (complex) on any failure.
        """
        import json
        import os
        import sys

        claude_cmd = "claude.cmd" if sys.platform == "win32" else "claude"
        classify_prompt = (
            "判断以下输入是否需要深入分析和多轮讨论。"
            "如果只是打招呼、简单提问、闲聊，回复 SIMPLE。"
            "如果是复杂需求、技术方案、需要分析的议题，回复 COMPLEX。"
            f"\n\n输入：{requirement}"
        )
        cmd = [
            claude_cmd, "-p", "-",
            "--output-format", "stream-json",
            "--model", "claude-haiku-4-5-20251001",
            "--max-turns", "1",
        ]
        env = dict(os.environ)
        if self.api_key:
            env["ANTHROPIC_API_KEY"] = self.api_key
        if self.api_base_url:
            env["ANTHROPIC_BASE_URL"] = self.api_base_url

        loop = asyncio.get_event_loop()

        def _run():
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE,
                env=env,
            )
            stdout, stderr = proc.communicate(
                input=classify_prompt.encode("utf-8"), timeout=10,
            )
            return stdout.decode("utf-8", errors="replace")

        try:
            stdout = await loop.run_in_executor(None, _run)
            for line in stdout.strip().splitlines():
                try:
                    data = json.loads(line.strip())
                    if data.get("type") == "result" and data.get("subtype") == "success":
                        result_text = (data.get("result") or "").strip().upper()
                        if "SIMPLE" in result_text:
                            return False
                        if "COMPLEX" in result_text:
                            return True
                except (json.JSONDecodeError, KeyError):
                    continue
            return True  # default to complex if no clear answer
        except Exception:
            import logging
            logging.getLogger(__name__).warning("Input classification failed, defaulting to complex")
            return True

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
        session_id = self._generate_session_id()
        session = Session.from_request(req, session_id)
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
        """Run the default 3-phase workflow."""
        session_dir = self.vault_manager._sessions_path / session.id

        # Phase 1: analyst (sequential)
        phase = session.phases[0]
        await self._run_phase(session, phase, "请分析以下需求并输出需求澄清文档。", session_dir)

        # Phase 2: architect (sequential)
        phase = session.phases[1]
        await self._run_parallel_phase(session, phase, session_dir)

        # Phase 3: writer (sequential)
        phase = session.phases[2]
        task = "请阅读所有前置文档，整合输出最终方案。"
        await self._run_phase(session, phase, task, session_dir)

    async def _run_brainstorm_workflow(self, session: Session) -> None:
        """Run brainstorm mode with input classification."""
        session_dir = self.vault_manager._sessions_path / session.id

        is_complex = await self._classify_input(session.input_requirement)

        if not is_complex:
            # Simple input: single-round casual response from all agents
            phase = session.phases[0]
            await self._run_casual_brainstorm(session, phase, session_dir)

            # Skip phase 2 (writer synthesis)
            if len(session.phases) > 1:
                session.phases[1].status = PhaseStatus.SKIPPED
                self.vault_manager.update_session(session)
        else:
            # Complex input: full multi-round brainstorm
            rounds = 3
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

    async def _run_casual_brainstorm(self, session: Session, phase: Any, session_dir: Path) -> None:
        """Run casual single-round brainstorm for simple inputs."""
        phase.status = PhaseStatus.RUNNING
        phase.started_at = datetime.now()
        self.vault_manager.update_session(session)
        await self.ws_manager.emit(session.id, "phase:started", phase=phase.id)

        task = f"请以你的角色身份直接回应以下内容：\n\n{session.input_requirement}"

        async def run_single(agent_id: str) -> AgentResult:
            agent_def = self._get_agent_def(agent_id)
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

        phase.status = PhaseStatus.COMPLETED if success_count > 0 else PhaseStatus.FAILED
        phase.completed_at = datetime.now()
        self.vault_manager.update_session(session)
        await self.ws_manager.emit(
            session.id, "phase:completed", phase=phase.id, outputs=added,
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
