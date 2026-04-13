from app.agent.parser import StreamEvent, parse_stream_line


def test_parse_assistant_text():
    """Parse assistant text event."""
    line = '{"type":"assistant","subtype":"text","content":"分析需求中的关键点..."}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "thinking"
    assert event.content == "分析需求中的关键点..."


def test_parse_tool_use():
    """Parse tool use event."""
    line = '{"type":"assistant","subtype":"tool_use","name":"Write","input":{"file_path":"01-需求澄清.md"}}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "working"
    assert event.tool_name == "Write"


def test_parse_tool_result_write():
    """Parse tool result for Write tool → output event."""
    line = '{"type":"tool_result","tool_use_id":"xyz","content":"File written successfully"}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "output"


def test_parse_result_success():
    """Parse final result success."""
    line = '{"type":"result","subtype":"success","result":"任务完成","cost_usd":0.05}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "completed"
    assert event.cost_usd == 0.05


def test_parse_result_error():
    """Parse final result error."""
    line = '{"type":"result","subtype":"error","error":"API error"}'
    event = parse_stream_line(line)
    assert event is not None
    assert event.type == "failed"
    assert event.error == "API error"


def test_parse_empty_line():
    """Empty line returns None."""
    assert parse_stream_line("") is None
    assert parse_stream_line("  ") is None


def test_parse_invalid_json():
    """Invalid JSON returns None."""
    assert parse_stream_line("not json") is None


def test_parse_unknown_type():
    """Unknown event type returns None."""
    line = '{"type":"system","subtype":"init"}'
    assert parse_stream_line(line) is None


def test_stream_event_model():
    """StreamEvent model holds all fields."""
    event = StreamEvent(type="thinking", content="hello")
    assert event.type == "thinking"
    assert event.tool_name is None
    assert event.cost_usd is None
