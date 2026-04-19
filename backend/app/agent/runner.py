import asyncio
import shutil
import subprocess
import sys
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
    api_base_url: str = ""
    allowed_tools: list[str] = []
    use_casual: bool = False


class AgentRunner:
    """Manages the lifecycle of a single Claude CLI agent subprocess."""

    def __init__(self, agent_def: AgentDefinition, config: AgentRunConfig):
        self.agent_def = agent_def
        self.config = config
        self._returncode: int | None = None
        self._stderr: str = ""
        self._process: subprocess.Popen | None = None

    async def prepare(self) -> None:
        """Create work directory and copy input files."""
        self.config.work_dir.mkdir(parents=True, exist_ok=True)
        for f in self.config.input_files:
            if f.exists():
                shutil.copy2(f, self.config.work_dir / f.name)

    def build_prompt(self, task: str) -> str:
        """Build the full prompt for claude -p."""
        if self.config.use_casual and self.agent_def.casual_prompt:
            parts = [self.agent_def.casual_prompt]
        else:
            parts = [self.agent_def.system_prompt]
            if self.agent_def.output_template:
                parts.append(
                    f"\n\n输出格式参考:\n{self.agent_def.output_template}"
                )
        parts.append(f"\n\n## 任务\n{task}")
        return "".join(parts)

    def _run_subprocess(self, cmd: list[str], cwd: str, env: dict, prompt_bytes: bytes, event_callback=None) -> list[StreamEvent]:
        """Run subprocess synchronously (called via run_in_executor)."""
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            env=env,
        )
        self._process = proc
        proc.stdin.write(prompt_bytes)
        proc.stdin.close()

        events: list[StreamEvent] = []
        for line in proc.stdout:
            raw = line.decode("utf-8", errors="replace").strip()
            event = parse_stream_line(raw)
            if event:
                events.append(event)
                if event_callback:
                    event_callback(event)

        proc.wait()
        self._returncode = proc.returncode
        self._stderr = proc.stderr.read().decode("utf-8", errors="replace").strip()
        proc.stderr.close()
        return events

    async def execute(self, task: str, event_callback=None) -> list[StreamEvent]:
        """Execute claude -p and stream events."""
        prompt = self.build_prompt(task)
        claude_cmd = "claude.cmd" if sys.platform == "win32" else "claude"
        cmd = [
            claude_cmd, "-p", "-",
            "--output-format", "stream-json",
            "--verbose",
            "--bare",
            "--max-turns", str(self.agent_def.max_turns),
        ]
        if self.config.allowed_tools:
            cmd.extend(["--allowedTools", " ".join(self.config.allowed_tools)])
        cmd.extend(["--disallowedTools", "WebSearch WebFetch"])
        if self.agent_def.model:
            cmd.extend(["--model", self.agent_def.model])

        import os
        env = dict(os.environ)
        if sys.platform == "win32":
            git_exe = shutil.which("git")
            if git_exe:
                git_root = Path(git_exe).parent.parent.parent
                git_bash = git_root / "bin" / "bash.exe"
                if git_bash.exists():
                    env["CLAUDE_CODE_GIT_BASH_PATH"] = str(git_bash)
        if self.config.api_key:
            env["ANTHROPIC_API_KEY"] = self.config.api_key
        if self.config.api_base_url:
            env["ANTHROPIC_BASE_URL"] = self.config.api_base_url

        loop = asyncio.get_event_loop()
        prompt_bytes = prompt.encode("utf-8")
        return await loop.run_in_executor(
            None, self._run_subprocess, cmd, str(self.config.work_dir), env, prompt_bytes, event_callback,
        )

    async def collect_outputs(self) -> list[str]:
        """Copy output files from work dir to session dir.

        Excludes files that were provided as inputs (copied from session_dir
        during prepare) to prevent duplicates across phases.
        """
        output_files: list[str] = []
        if not self.config.work_dir.exists():
            return output_files

        input_names = {f.name for f in self.config.input_files if f.exists()}

        for f in self.config.work_dir.iterdir():
            if f.is_file() and f.suffix in (".md", ".yaml", ".json", ".txt"):
                shutil.copy2(f, self.config.session_dir / f.name)
                if f.name not in input_names:
                    output_files.append(f.name)

        return output_files

    def _save_output_from_events(self, events: list[StreamEvent]) -> None:
        """Write agent output to file extracted from stream events."""
        if not self.agent_def.output_file:
            return
        final = next((e for e in reversed(events) if e.type == "completed" and e.content), None)
        if not final or not final.content:
            return
        self.config.work_dir.mkdir(parents=True, exist_ok=True)
        (self.config.work_dir / self.agent_def.output_file).write_text(final.content, encoding="utf-8")

    async def cleanup(self) -> None:
        """Remove work directory."""
        if self.config.work_dir.exists():
            shutil.rmtree(self.config.work_dir)

    async def kill(self) -> None:
        """Force-kill the subprocess."""
        if self._process and self._process.poll() is None:
            self._process.kill()

    async def run(self, task: str, event_callback=None) -> AgentResult:
        """Full lifecycle: prepare -> execute -> collect -> cleanup."""
        start = time.monotonic()
        try:
            await self.prepare()
            events = await self.execute(task, event_callback)
            self._save_output_from_events(events)
            output_files = await self.collect_outputs()

            # Check result
            final = next((e for e in reversed(events) if e.type in ("completed", "failed")), None)
            success = final is not None and final.type == "completed"

            error_msg = None
            if not success:
                error_msg = final.error if final and final.type == "failed" else None
                if self._stderr:
                    error_msg = f"{error_msg or 'Process exited with non-zero code'}\nstderr: {self._stderr}"

            return AgentResult(
                agent_id=self.agent_def.id,
                success=success,
                output_files=output_files,
                error=error_msg,
                duration_ms=int((time.monotonic() - start) * 1000),
            )
        except Exception as e:
            import logging, traceback
            logging.getLogger(__name__).error(
                "[RUNNER] agent=%s exc=%s\n%s",
                self.agent_def.id, e, traceback.format_exc(),
            )
            return AgentResult(
                agent_id=self.agent_def.id,
                success=False,
                error=str(e),
                duration_ms=int((time.monotonic() - start) * 1000),
            )
        finally:
            await self.cleanup()
