import asyncio
import shutil
import time
from pathlib import Path

from pydantic import BaseModel, ConfigDict

from app.agent.parser import parse_stream_line, StreamEvent
from app.workflow.models import AgentDefinition, AgentResult


class AgentRunConfig(BaseModel):
    """Configuration for a single agent run."""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    work_dir: Path
    session_dir: Path
    input_files: list[Path] = []
    timeout_seconds: int = 300
    api_key: str = ""


class AgentRunner:
    """Manages the lifecycle of a single Claude CLI agent subprocess."""

    def __init__(self, agent_def: AgentDefinition, config: AgentRunConfig):
        self.agent_def = agent_def
        self.config = config
        self._process: asyncio.subprocess.Process | None = None

    async def prepare(self) -> None:
        """Create work directory and copy input files."""
        self.config.work_dir.mkdir(parents=True, exist_ok=True)
        for f in self.config.input_files:
            if f.exists():
                shutil.copy2(f, self.config.work_dir / f.name)

    def build_prompt(self, task: str) -> str:
        """Build the full prompt for claude -p."""
        parts = [self.agent_def.system_prompt]
        if self.agent_def.output_file:
            parts.append(
                f"\n\n请将你的分析结果写入文件: {self.agent_def.output_file}"
            )
        if self.agent_def.output_template:
            parts.append(
                f"\n\n输出格式参考:\n{self.agent_def.output_template}"
            )
        parts.append(f"\n\n## 任务\n{task}")
        return "".join(parts)

    async def execute(self, task: str, event_callback=None) -> list[StreamEvent]:
        """Execute claude -p and stream events."""
        prompt = self.build_prompt(task)
        cmd = [
            "claude", "-p", prompt,
            "--output-format", "stream-json",
            "--verbose",
            "--max-turns", str(self.agent_def.max_turns),
        ]

        env = None
        if self.config.api_key:
            import os
            env = {**os.environ, "ANTHROPIC_API_KEY": self.config.api_key}

        self._process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(self.config.work_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

        events: list[StreamEvent] = []
        assert self._process.stdout is not None

        async for line in self._process.stdout:
            raw = line.decode("utf-8").strip()
            event = parse_stream_line(raw)
            if event:
                events.append(event)
                if event_callback:
                    await event_callback(event)

        await self._process.wait()
        return events

    async def collect_outputs(self) -> list[str]:
        """Copy output files from work dir to session dir."""
        output_files: list[str] = []
        if not self.config.work_dir.exists():
            return output_files

        for f in self.config.work_dir.iterdir():
            if f.is_file() and f.suffix in (".md", ".yaml", ".json", ".txt"):
                shutil.copy2(f, self.config.session_dir / f.name)
                output_files.append(f.name)

        return output_files

    async def cleanup(self) -> None:
        """Remove work directory."""
        if self.config.work_dir.exists():
            shutil.rmtree(self.config.work_dir)

    async def kill(self) -> None:
        """Force-kill the subprocess."""
        if self._process and self._process.returncode is None:
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self._process.kill()

    async def run(self, task: str, event_callback=None) -> AgentResult:
        """Full lifecycle: prepare -> execute -> collect -> cleanup."""
        start = time.monotonic()
        try:
            await self.prepare()
            events = await self.execute(task, event_callback)
            output_files = await self.collect_outputs()

            # Capture stderr for diagnostics if process failed
            stderr_info = ""
            if self._process and self._process.returncode != 0 and self._process.stderr:
                stderr_bytes = await self._process.stderr.read()
                stderr_info = stderr_bytes.decode("utf-8", errors="replace").strip()

            # Check result
            final = next((e for e in reversed(events) if e.type in ("completed", "failed")), None)
            success = final is not None and final.type == "completed"

            error_msg = None
            if not success:
                error_msg = final.error if final and final.type == "failed" else None
                if stderr_info:
                    error_msg = f"{error_msg or 'Process exited with non-zero code'}\nstderr: {stderr_info}"

            return AgentResult(
                agent_id=self.agent_def.id,
                success=success,
                output_files=output_files,
                error=error_msg,
                duration_ms=int((time.monotonic() - start) * 1000),
            )
        except Exception as e:
            return AgentResult(
                agent_id=self.agent_def.id,
                success=False,
                error=str(e),
                duration_ms=int((time.monotonic() - start) * 1000),
            )
        finally:
            await self.cleanup()
