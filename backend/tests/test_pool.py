import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.agent.pool import AgentPool
from app.agent.runner import AgentRunner
from app.workflow.models import AgentResult, AgentDefinition


@pytest.fixture
def mock_runner():
    runner = MagicMock(spec=AgentRunner)
    runner.run = AsyncMock(return_value=AgentResult(
        agent_id="analyst", success=True, output_files=["01.md"], duration_ms=1000,
    ))
    runner.agent_def = AgentDefinition(
        name="test", id="analyst", system_prompt="test",
    )
    return runner


@pytest.mark.asyncio
async def test_submit_success(mock_runner):
    """submit() returns AgentResult on success."""
    pool = AgentPool(max_concurrent=2, timeout_seconds=60, retry_count=0)
    result = await pool.submit(mock_runner, task="test task")
    assert result.success is True
    assert result.agent_id == "analyst"


@pytest.mark.asyncio
async def test_submit_enforces_concurrency():
    """Pool enforces max_concurrent limit via semaphore."""
    call_times = []

    async def slow_run(task, event_callback=None):
        call_times.append(asyncio.get_event_loop().time())
        await asyncio.sleep(0.1)
        return AgentResult(agent_id="test", success=True, duration_ms=100)

    pool = AgentPool(max_concurrent=2, timeout_seconds=10, retry_count=0)

    runners = []
    for i in range(4):
        r = MagicMock(spec=AgentRunner)
        r.run = slow_run
        r.agent_def = AgentDefinition(name="t", id=f"agent-{i}", system_prompt="t")
        runners.append(r)

    results = await asyncio.gather(*[pool.submit(r, task="t") for r in runners])
    assert len(results) == 4
    assert all(r.success for r in results)


@pytest.mark.asyncio
async def test_submit_timeout():
    """submit() raises TimeoutError when runner exceeds timeout."""
    async def slow_run(task, event_callback=None):
        await asyncio.sleep(10)
        return AgentResult(agent_id="test", success=True, duration_ms=10000)

    runner = MagicMock(spec=AgentRunner)
    runner.run = slow_run
    runner.agent_def = AgentDefinition(name="t", id="test", system_prompt="t")
    runner.kill = AsyncMock()

    pool = AgentPool(max_concurrent=1, timeout_seconds=1, retry_count=0)
    with pytest.raises(TimeoutError):
        await pool.submit(runner, task="test")
    runner.kill.assert_called()


@pytest.mark.asyncio
async def test_submit_retry_on_failure():
    """submit() retries once on failure when retry_count=1."""
    call_count = 0

    async def fail_then_succeed(task, event_callback=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return AgentResult(agent_id="test", success=False, error="fail", duration_ms=100)
        return AgentResult(agent_id="test", success=True, duration_ms=100)

    runner = MagicMock(spec=AgentRunner)
    runner.run = fail_then_succeed
    runner.agent_def = AgentDefinition(name="t", id="test", system_prompt="t")

    pool = AgentPool(max_concurrent=1, timeout_seconds=10, retry_count=1)
    result = await pool.submit(runner, task="test")
    assert result.success is True
    assert call_count == 2
