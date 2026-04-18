# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AgentOffice 是一个多智能体协作系统，通过编排 Claude CLI 子进程来分析需求并生成结构化文档。采用 **Supervisor 单体架构**，FastAPI 后端管理智能体生命周期和工作流，React 前端提供基于 PixiJS 的可视化办公场景界面。

## 常用命令

### 后端

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

### 前端

```bash
# 安装依赖
cd frontend && npm install

# 启动开发服务器（端口 3000，自动代理 /api 到后端 8000）
cd frontend && npm run dev

# 构建
cd frontend && npm run build

# 运行测试
cd frontend && npm run test
```

后端测试使用 `pytest-asyncio`，`asyncio_mode = "auto"`，async 测试函数无需额外标记。

## 架构

### 系统总览

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React + PixiJS + TailwindCSS)            │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  PixiJS Canvas│  │  HTML Overlay (Zustand 状态) │ │
│  │  (OfficeMap,  │  │  (StatusBar, AgentDetail,    │ │
│  │   AgentSprite)│  │   DocViewer, ArchiveDrawer)  │ │
│  └──────┬───────┘  └──────────────┬───────────────┘ │
│         └────────────┬────────────┘                  │
│              API + WebSocket                         │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│  Backend (FastAPI)                                   │
│  Client → API Router → WorkflowEngine → AgentPool    │
│  → AgentRunner → claude -p (子进程)                  │
│        ↕                    ↕                        │
│  VaultManager (文件 I/O)  WebSocketManager (实时事件) │
└─────────────────────────────────────────────────────┘
```

### 后端核心组件（`backend/app/`）

- **`workflow/engine.py`** — 中央编排器。管理 session 生命周期，按阶段执行工作流。两种模式：
  - `default`：3 阶段流水线 — analyst → (architect + researcher 并行) → writer
  - `brainstorm`：N 轮并行讨论，最后由 writer 综合输出
- **`workflow/models.py`** — 数据模型（SessionStatus、PhaseStatus、AgentDefinition 等 Pydantic 模型）
- **`agent/runner.py`** — 封装单个 `claude -p --output-format stream-json` 子进程。处理 prepare/execute/collect/cleanup 完整生命周期。
- **`agent/pool.py`** — 基于信号量的并发限制器，含超时和重试逻辑。
- **`agent/parser.py`** — 将 Claude CLI 的 NDJSON 流解析为类型化的 `StreamEvent` 对象。
- **`vault/manager.py`** — 基于文件的持久化。Session 是 `vault/sessions/<id>/` 下的目录，包含 `meta.yaml` 和智能体输出的 markdown 文件。
- **`ws/manager.py`** — WebSocket 广播器，推送 session 事件（阶段开始/完成等）。
- **`api/sessions.py`** — Session 相关 REST 端点和 WebSocket 端点。
- **`api/agents.py`** — Agent 定义查询端点。
- **`config.py`** — Pydantic 配置模型，从 `settings.yaml` 加载。
- **`dependencies.py`** — 应用启动时组装 VaultManager → AgentPool → WebSocketManager → WorkflowEngine。

### 前端核心组件（`frontend/src/`）

**Canvas 层**（`components/canvas/`）：
- **`PixiCanvas.tsx`** — 全屏 PixiJS 舞台，响应式尺寸
- **`OfficeMap.tsx`** — 办公室地图渲染（走廊、房间、墙壁、标签），支持点击交互
- **`AgentSprite.tsx`** — 智能体精灵（彩色圆点），支持 idle/walking/working/thinking 动画状态
- **`CelebrationEffect.tsx`** — 任务完成时的庆祝动画效果
- **`FlyingDocument.tsx`** — 文档生成时的飞入动画效果

**Overlay 层**（`components/overlay/`）：
- **`NewTaskModal.tsx`** — 新建任务提交界面
- **`StatusBar.tsx`** — 底部状态栏（session 状态、阶段进度、操作按钮）
- **`AgentDetailPanel.tsx`** — 右侧面板（智能体详情、思考内容、工具使用、输出文件）
- **`DocViewer.tsx`** — 文档查看器（markdown 渲染）
- **`ArchiveDrawer.tsx`** — 历史会话抽屉（浏览/加载历史 session）

**UI 组件**（`components/ui/`）：
- **`Modal.tsx`** — 可复用模态框（支持 ESC 关闭）

**状态管理**（`stores/`）：
- **`agentStore.ts`** — 智能体视觉状态（动画、思考内容、工具使用、输出文件）
- **`sessionStore.ts`** — Session 数据和生命周期管理，集成 API 调用
- **`uiStore.ts`** — UI 组件可见性控制

**Hooks**（`hooks/`）：
- **`useWebSocket.ts`** — WebSocket 连接管理，自动重连，事件分发到 store
- **`useSession.ts`** — Session 列表加载

**配置数据**（`data/`）：
- **`agentConfig.ts`** — 4 个智能体的视觉属性和房间位置
- **`mapConfig.ts`** — 办公室布局（4 个房间：meeting、design、writing、archive）
- **`spritesheets/`** — 精灵帧动画定义

**服务**（`services/`）：
- **`api.ts`** — 基于原生 fetch 的 HTTP 客户端，封装所有后端 API 调用

### 智能体定义

智能体角色以 YAML 文件定义在 `vault/agents/`（analyst、architect、researcher、writer）。每个文件指定 `id`、`model`、`system_prompt`、`output_file` 名称和可选的 `output_template`。添加新智能体只需在该目录放入 YAML 文件。

### API 结构

- `POST /api/sessions` — 创建并运行工作流 session
- `GET /api/sessions` / `GET /api/sessions/{id}` — 列出/获取 session
- `GET /api/sessions/{id}/outputs` / `GET /api/sessions/{id}/outputs/{filename}` — 访问智能体输出
- `GET /api/sessions/{id}/workflow` — 阶段级状态
- `POST /api/sessions/{id}/pause|resume|cancel` — Session 控制
- `DELETE /api/sessions/{id}` — 删除已完成/失败/取消的 session
- `GET /api/agents` / `GET /api/agents/{id}` — 列出/获取智能体定义
- `WS /api/ws/sessions/{id}` — 实时 session 事件流

### 配置

`backend/settings.yaml` 控制服务器、智能体池、vault 路径和工作流设置。通过 `app/config.py` 加载为 pydantic 模型。

前端 Vite 开发服务器端口 3000，自动将 `/api` 请求代理到后端 `http://localhost:8000`（含 WebSocket）。

### 数据流

1. 客户端 POST 需求 → `WorkflowEngine` 创建 `Session`，分配各阶段的 `AgentDefinition`
2. 每个阶段通过 `AgentPool` 生成 `AgentRunner` 子进程
3. 智能体输出（markdown 文件）从工作目录收集到 session 目录（通过 `VaultManager`）
4. 后续阶段接收前序阶段的输出文件作为输入上下文
5. 每个阶段转换时通过 WebSocket 推送事件
6. 前端通过 `useWebSocket` hook 接收事件，更新 `agentStore` 和 `sessionStore`，驱动 Canvas 和 Overlay 刷新

## 技术栈

| 层级 | 后端 | 前端 |
|------|------|------|
| 框架 | FastAPI + Uvicorn | React 18 + TypeScript |
| 构建 | uv + pyproject.toml | Vite |
| 样式 | — | TailwindCSS |
| 状态 | Pydantic 模型 | Zustand |
| 实时 | WebSocket | WebSocket + EventSource |
| HTTP | FastAPI 路由 | fetch |
| 测试 | pytest + pytest-asyncio + httpx | Vitest + Testing Library |
| 可视化 | — | PixiJS + pixi-viewport |

## 测试结构

### 后端（`backend/tests/`）

- `conftest.py` — 共享 fixtures（临时 vault、临时 settings）
- `test_api.py` — FastAPI 端点测试
- `test_workflow.py` — WorkflowEngine 测试
- `test_vault.py` — VaultManager 测试
- `test_agent_runner.py` — AgentRunner 测试
- `test_pool.py` — AgentPool 测试
- `test_parser.py` — 流解析器测试
- `test_models.py` — Pydantic 模型验证
- `test_session_control.py` — Session 暂停/恢复/取消
- `test_integration.py` — 端到端集成测试
- `test_ws.py` — WebSocket 测试
- `test_config.py` — 配置加载测试

### 前端（`frontend/tests/`）

- 使用 Vitest + jsdom 环境
- `npm run test` 或 `npm run test:watch`

## 关键设计决策

- 智能体以 `claude -p` 子进程方式运行，而非 SDK 调用 — 系统与 Claude CLI 的 `stream-json` 输出格式耦合
- 状态持久化基于文件（vault 目录中的 YAML + markdown），不使用数据库
- Engine 依赖注入使用模块级全局变量（在应用启动时设置），而非 FastAPI 的依赖注入系统
- 前端采用双层渲染架构：PixiJS Canvas 处理性能敏感的可视化，HTML Overlay 处理 UI 交互
- 前端 API 通过 Vite proxy 统一代理到后端，避免跨域问题
- VaultManager 读取 meta.yaml 时兼容 UTF-8 和 GBK 编码（Windows 中文环境下历史文件可能为 GBK 编码）
- **Windows 上 uvicorn `--reload` 不可靠**：文件变更后自动热重载经常不生效（即使 WatchFiles 检测到变更，子进程仍可能运行旧代码）。修改后端代码后，务必手动杀掉所有 Python/uvicorn 进程（`taskkill`）并删除 `__pycache__`，再重新启动服务器，否则修改不会生效。
