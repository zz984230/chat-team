# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AgentOffice 是一个多智能体协作系统，通过编排 Claude CLI 子进程来分析需求并生成结构化文档。采用 **Supervisor 单体架构**，FastAPI 后端管理智能体生命周期和工作流。

## 常用命令

```bash
# 安装依赖
cd backend && uv sync

# 启动服务
cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 运行全部测试
cd backend && uv run pytest

# 运行单个测试文件
cd backend && uv run pytest tests/test_parser.py

# 按名称运行指定测试
cd backend && uv run pytest tests/test_pool.py::test_submit_success -v
```

测试使用 `pytest-asyncio`，`asyncio_mode = "auto"`，async 测试函数无需额外标记。

## 架构

### 请求流

```
Client → FastAPI (/api/sessions, /api/agents) → WorkflowEngine → AgentPool → AgentRunner → claude -p (子进程)
                                                                          ↕
                                                                     VaultManager (文件 I/O)
                                                                          ↕
                                                                     WebSocketManager (实时事件)
```

### 核心组件（均在 `backend/app/` 下）

- **`workflow/engine.py`** — 中央编排器。管理 session 生命周期，按阶段执行工作流。两种模式：
  - `default`：3 阶段流水线 — analyst → (architect + researcher 并行) → writer
  - `brainstorm`：N 轮并行讨论，最后由 writer 综合输出
- **`agent/runner.py`** — 封装单个 `claude -p --output-format stream-json` 子进程。处理 prepare/execute/collect/cleanup 完整生命周期。
- **`agent/pool.py`** — 基于信号量的并发限制器，含超时和重试逻辑。
- **`agent/parser.py`** — 将 Claude CLI 的 NDJSON 流解析为类型化的 `StreamEvent` 对象。
- **`vault/manager.py`** — 基于文件的持久化。Session 是 `vault/sessions/<id>/` 下的目录，包含 `meta.yaml` 和智能体输出的 markdown 文件。
- **`ws/manager.py`** — WebSocket 广播器，推送 session 事件（阶段开始/完成等）。
- **`dependencies.py`** — 应用启动时组装 VaultManager → AgentPool → WebSocketManager → WorkflowEngine。

### 智能体定义

智能体角色以 YAML 文件定义在 `vault/agents/`（analyst、architect、researcher、writer）。每个文件指定 `id`、`model`、`system_prompt`、`output_file` 名称和可选的 `output_template`。添加新智能体只需在该目录放入 YAML 文件。

### API 结构

- `POST /api/sessions` — 创建并运行工作流 session
- `GET /api/sessions` / `GET /api/sessions/{id}` — 列出/获取 session
- `GET /api/sessions/{id}/outputs` / `GET /api/sessions/{id}/outputs/{filename}` — 访问智能体输出
- `GET /api/sessions/{id}/workflow` — 阶段级状态
- `POST /api/sessions/{id}/pause|resume|cancel` — Session 控制
- `GET /api/agents` / `GET /api/agents/{id}` — 列出/获取智能体定义
- `WS /api/ws/sessions/{id}` — 实时 session 事件流

### 配置

`backend/settings.yaml` 控制服务器、智能体池、vault 路径和工作流设置。通过 `app/config.py` 加载为 pydantic 模型。

### 数据流

1. 客户端 POST 需求 → `WorkflowEngine` 创建 `Session`，分配各阶段的 `AgentDefinition`
2. 每个阶段通过 `AgentPool` 生成 `AgentRunner` 子进程
3. 智能体输出（markdown 文件）从工作目录收集到 session 目录（通过 `VaultManager`）
4. 后续阶段接收前序阶段的输出文件作为输入上下文
5. 每个阶段转换时通过 WebSocket 推送事件

## 关键设计决策

- 智能体以 `claude -p` 子进程方式运行，而非 SDK 调用 — 系统与 Claude CLI 的 `stream-json` 输出格式耦合
- 状态持久化基于文件（vault 目录中的 YAML + markdown），不使用数据库
- Engine 依赖注入使用模块级全局变量（在应用启动时设置），而非 FastAPI 的依赖注入系统
