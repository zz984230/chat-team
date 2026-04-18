from pathlib import Path

from app.agent.runner import AgentRunner, AgentRunConfig
from app.workflow.models import AgentDefinition


def test_build_prompt_casual_uses_casual_prompt():
    agent_def = AgentDefinition(
        name="需求分析师",
        id="analyst",
        system_prompt="正式 system prompt",
        casual_prompt="轻松回应即可。",
        output_template="## 模板",
    )
    config = AgentRunConfig(
        work_dir=Path("/tmp/test"),
        session_dir=Path("/tmp/test-session"),
        use_casual=True,
    )
    runner = AgentRunner(agent_def, config)
    prompt = runner.build_prompt("你好")
    assert "轻松回应即可。" in prompt
    assert "正式 system prompt" not in prompt
    assert "模板" not in prompt


def test_build_prompt_default_uses_system_prompt():
    agent_def = AgentDefinition(
        name="需求分析师",
        id="analyst",
        system_prompt="正式 system prompt",
        output_template="## 模板",
    )
    config = AgentRunConfig(
        work_dir=Path("/tmp/test"),
        session_dir=Path("/tmp/test-session"),
    )
    runner = AgentRunner(agent_def, config)
    prompt = runner.build_prompt("分析需求")
    assert "正式 system prompt" in prompt
    assert "模板" in prompt


def test_build_prompt_casual_without_casual_prompt_falls_back():
    agent_def = AgentDefinition(
        name="需求分析师",
        id="analyst",
        system_prompt="正式 system prompt",
        output_template="## 模板",
    )
    config = AgentRunConfig(
        work_dir=Path("/tmp/test"),
        session_dir=Path("/tmp/test-session"),
        use_casual=True,
    )
    runner = AgentRunner(agent_def, config)
    prompt = runner.build_prompt("你好")
    # Falls back to system_prompt when casual_prompt is None
    assert "正式 system prompt" in prompt
