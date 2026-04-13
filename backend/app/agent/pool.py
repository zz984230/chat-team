import asyncio

from app.agent.runner import AgentRunner
from app.workflow.models import AgentResult


class AgentPool:
    """Concurrent agent execution pool with semaphore-based limiting."""

    def __init__(self, max_concurrent: int = 5, timeout_seconds: int = 300, retry_count: int = 1):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.timeout_seconds = timeout_seconds
        self.retry_count = retry_count
        self.active_runners: dict[str, AgentRunner] = {}

    async def submit(self, runner: AgentRunner, task: str, event_callback=None) -> AgentResult:
        """Submit a runner to the pool. Respects concurrency limit and retries on failure."""
        async with self.semaphore:
            self.active_runners[runner.agent_def.id] = runner
            try:
                return await self._run_with_retry(runner, task, event_callback)
            finally:
                self.active_runners.pop(runner.agent_def.id, None)

    async def _run_with_retry(self, runner: AgentRunner, task: str, event_callback=None) -> AgentResult:
        """Run with timeout and retry logic."""
        last_error = None
        for attempt in range(self.retry_count + 1):
            try:
                result = await asyncio.wait_for(
                    runner.run(task, event_callback),
                    timeout=self.timeout_seconds,
                )
                if result.success:
                    return result
                last_error = result.error
                if attempt < self.retry_count:
                    continue
                return result
            except asyncio.TimeoutError:
                await runner.kill()
                last_error = f"Agent timed out after {self.timeout_seconds}s"
                if attempt < self.retry_count:
                    continue
                raise TimeoutError(last_error)
        return AgentResult(
            agent_id=runner.agent_def.id,
            success=False,
            error=last_error,
        )

    @property
    def active_count(self) -> int:
        return len(self.active_runners)
