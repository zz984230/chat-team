import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from app.agent.runner import AgentRunner, AgentRunConfig
from app.workflow.models import AgentDefinition, AgentResult


@pytest.fixture
def analyst_def() -> AgentDefinition:
    return AgentDefinition(
        name="需求分析师",
        id="analyst",
        system_prompt="你是一位资深需求分析师。",
        output_file="01-需求澄清.md",
    )


@pytest.fixture
def run_config(tmp_path: Path) -> AgentRunConfig:
    return AgentRunConfig(
        work_dir=tmp_path / "work",
        session_dir=tmp_path / "session",
        input_files=[],
    )


@pytest.mark.asyncio
async def test_prepare_creates_work_dir(analyst_def: AgentDefinition, run_config: AgentRunConfig):
    """prepare() creates work directory and copies input files."""
    # Create an input file
    run_config.session_dir.mkdir(parents=True, exist_ok=True)
    input_file = run_config.session_dir / "00-原始需求.md"
    input_file.write_text("test requirement", encoding="utf-8")
    run_config.input_files = [input_file]

    runner = AgentRunner(analyst_def, run_config)
    await runner.prepare()

    assert run_config.work_dir.is_dir()
    assert (run_config.work_dir / "00-原始需求.md").read_text(encoding="utf-8") == "test requirement"


@pytest.mark.asyncio
async def test_build_prompt(analyst_def: AgentDefinition, run_config: AgentRunConfig):
    """build_prompt() includes system_prompt and output_file instruction."""
    runner = AgentRunner(analyst_def, run_config)
    prompt = runner.build_prompt("分析需求")

    assert "资深需求分析师" in prompt
    assert "分析需求" in prompt
    assert "01-需求澄清.md" in prompt


@pytest.mark.asyncio
async def test_collect_outputs(analyst_def: AgentDefinition, run_config: AgentRunConfig):
    """collect_outputs() copies output files from work dir to session dir."""
    run_config.work_dir.mkdir(parents=True, exist_ok=True)
    run_config.session_dir.mkdir(parents=True, exist_ok=True)
    (run_config.work_dir / "01-需求澄清.md").write_text("# 澄清结果", encoding="utf-8")

    runner = AgentRunner(analyst_def, run_config)
    output_files = await runner.collect_outputs()

    assert "01-需求澄清.md" in output_files
    assert (run_config.session_dir / "01-需求澄清.md").read_text(encoding="utf-8") == "# 澄清结果"


@pytest.mark.asyncio
async def test_cleanup(analyst_def: AgentDefinition, run_config: AgentRunConfig):
    """cleanup() removes work directory."""
    run_config.work_dir.mkdir(parents=True, exist_ok=True)
    (run_config.work_dir / "temp.txt").write_text("temp", encoding="utf-8")

    runner = AgentRunner(analyst_def, run_config)
    await runner.cleanup()

    assert not run_config.work_dir.exists()
