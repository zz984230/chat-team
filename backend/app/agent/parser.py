import json
from typing import Any

from pydantic import BaseModel


class StreamEvent(BaseModel):
    """Parsed event from Claude CLI stream-json output."""
    type: str  # thinking, working, output, completed, failed
    content: str | None = None
    tool_name: str | None = None
    tool_input: dict[str, Any] = {}
    error: str | None = None
    cost_usd: float | None = None


def parse_stream_line(line: str) -> StreamEvent | None:
    """Parse a single line of Claude CLI stream-json output.

    Returns None for empty lines, invalid JSON, or unknown event types.
    """
    line = line.strip()
    if not line:
        return None

    try:
        data: dict[str, Any] = json.loads(line)
    except json.JSONDecodeError:
        return None

    event_type = data.get("type")
    subtype = data.get("subtype")

    if event_type == "assistant":
        if subtype == "text":
            return StreamEvent(type="thinking", content=data.get("content", ""))
        elif subtype == "tool_use":
            return StreamEvent(type="working", tool_name=data.get("name"), tool_input=data.get("input", {}))

    elif event_type == "tool_result":
        return StreamEvent(type="output")

    elif event_type == "result":
        if subtype == "success":
            return StreamEvent(
                type="completed",
                content=data.get("result"),
                cost_usd=data.get("cost_usd"),
            )
        else:
            return StreamEvent(
                type="failed",
                error=data.get("error", data.get("errors", "unknown error")),
            )

    return None
