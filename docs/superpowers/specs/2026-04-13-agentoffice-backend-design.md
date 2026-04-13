# AgentOffice 后端设计文档 — 第一阶段

**日期**: 2026-04-13
**状态**: Approved
**范围**: Supervisor 编排层 + Agent 工作流 + Obsidian Vault 存储

---

## 1. 概述

AgentOffice 是一个基于多 Agent 协作的虚拟团队系统。用户通过 Web UI 提交需求，系统调度多个 Claude CLI Agent 协作处理，产出结构化方案文档。

**第一阶段目标**：实现完整的后端系统，包括工作流引擎、Agent 管理、API 接口和数据存储。前端可视化在第二阶段实施。

### 1.1 核心决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 架构模式 | Supervisor 单体 | 5-10 并发规模无需消息队列，架构最简 |
| 后端语言 | Python 3.11+ | asyncio 成熟，subprocess 管理方便 |
| Web 框架 | FastAPI | 原生 async + WebSocket，自动 API 文档 |
| Agent 实现 | Claude CLI 子进程 | 直接利用 Claude Code 能力，无需自建工具层 |
| 数据存储 | Obsidian Vault (文件系统) | 纯文本，可读性强，Obsidian 直接查看 |
| 向量搜索 | 第一阶段跳过 | 用简单文件匹配，后续再加 |
| 隔离方式 | 临时目录 | 比 Git Worktree 简单，效果等价 |

### 1.2 不在范围内

- PixiJS 前端可视化
- 向量搜索 (QMD/ChromaDB)
- 自定义工作流编辑器
- 多用户认证
- Docker 部署

---

## 2. 项目结构

```
chat-team/
├── backend/                        # Python 后端
│   ├── app/
│   │   ├── main.py                # FastAPI 入口 + 应用工厂
│   │   ├── config.py              # Pydantic 配置模型
│   │   ├── api/
│   │   │   ├── sessions.py        # 会话管理 REST API
│   │   │   └── agents.py          # Agent 定义查询 API
│   │   ├── ws/
│   │   │   └── manager.py         # WebSocket 连接管理 + 事件广播
│   │   ├── workflow/
│   │   │   ├── engine.py          # 工作流调度核心
│   │   │   ├── phases.py          # 四阶段流程定义
│   │   │   └── models.py          # 工作流数据模型 (Pydantic)
│   │   ├── agent/
│   │   │   ├── runner.py          # Claude CLI 子进程管理
│   │   │   ├── pool.py            # 进程池 + 信号量 + 超时
│   │   │   ├── parser.py          # stream-json 输出解析
│   │   │   └── definitions/       # 内置 Agent YAML 定义
│   │   └── vault/
│   │       ├── manager.py         # Vault 文件读写
│   │       └── session.py         # 会话目录管理
│   ├── tests/
│   │   ├── test_workflow.py
│   │   ├── test_agent_runner.py
│   │   ├── test_parser.py
│   │   └── test_api.py
│   ├── pyproject.toml
│   └── settings.yaml
│
├── vault/                         # Obsidian Vault 数据存储
│   ├── agents/                    # Agent 角色定义 YAML
│   ├── sessions/                  # 会话产出目录
│   ├── memory/                    # 持久化共享记忆
│   └── kanban/                    # 任务看板
│
├── frontend/                      # 第二阶段
└── doc/
```

---

## 3. 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 语言 | Python | 3.11+ |
| 包管理 | uv | latest |
| Web 框架 | FastAPI | 0.115+ |
| ASGI 服务器 | Uvicorn | 0.34+ |
| 数据验证 | Pydantic | 2.x |
| YAML 解析 | PyYAML | 6.x |
| 测试 | pytest + pytest-asyncio | latest |

---

## 4. API 设计

### 4.1 REST API

```
POST   /api/sessions                 创建会话并提交需求
GET    /api/sessions                 列出所有会话
GET    /api/sessions/{id}            获取会话详情
POST   /api/sessions/{id}/pause      暂停会话
POST   /api/sessions/{id}/resume     恢复会话
POST   /api/sessions/{id}/cancel     取消会话

GET    /api/agents                   列出可用 Agent 定义
GET    /api/agents/{id}              获取 Agent 详情

GET    /api/sessions/{id}/workflow   获取工作流状态
GET    /api/sessions/{id}/outputs    获取产出文件列表
GET    /api/sessions/{id}/outputs/{file}  获取具体产出内容

WS     /ws/sessions/{id}             实时事件流
```

### 4.2 创建会话请求

```json
POST /api/sessions
{
  "requirement": "设计一个电商系统",
  "mode": "default",
  "agents": null,
  "config": {
    "rounds": 3
  }
}
```

- `mode`: `"default"` (四角色流程) | `"brainstorm"` (头脑风暴)
- `agents`: `null` 使用默认角色，或指定角色 ID 列表
- `config.rounds`: 仅 brainstorm 模式，默认 3 轮

### 4.3 会话响应

```json
GET /api/sessions/{id}
{
  "id": "20260413-153000-abc",
  "status": "running",
  "mode": "default",
  "created_at": "2026-04-13T15:30:00",
  "updated_at": "2026-04-13T15:32:00",
  "phases": [
    {"id": 1, "name": "需求分析", "status": "completed", "agents": ["analyst"]},
    {"id": 2, "name": "方案设计", "status": "running", "agents": ["architect", "researcher"]},
    {"id": 3, "name": "整合输出", "status": "pending", "agents": ["writer"]}
  ],
  "outputs": ["01-需求澄清.md", "02-技术方案.md"]
}
```

### 4.4 WebSocket 事件

三级事件结构（Server → Client）：

**会话级别**：
- `session:started` — 工作流开始
- `session:completed` — 工作流完成
- `session:failed` — 工作流失败
- `session:paused` / `session:cancelled`

**阶段级别**：
- `phase:started` — `{ phase, agents }`
- `phase:completed` — `{ phase, outputs }`
- `phase:failed` — `{ phase, error }`

**Agent 级别**：
- `agent:started` — `{ agent_id, agent_name }`
- `agent:thinking` — `{ agent_id, content }` — Claude 的推理文本片段
- `agent:working` — `{ agent_id, tool }` — 正在使用的工具
- `agent:output` — `{ agent_id, file }` — 产出文件
- `agent:completed` — `{ agent_id, duration_ms }`
- `agent:failed` — `{ agent_id, error }`

---

## 5. 工作流引擎

### 5.1 默认四角色流程

顺序 + 并行混合执行：

1. **Phase 1 — 需求分析**（顺序）
   - Agent: `analyst` (需求分析师)
   - 输入: `00-原始需求.md`
   - 输出: `01-需求澄清.md`

2. **Phase 2 — 方案设计**（并行）
   - Agent A: `architect` (方案架构师) → `02-技术方案.md`
   - Agent B: `researcher` (资料研究员) → `03-参考资料.md`
   - 两个 Agent 并行执行，通过 `asyncio.gather` 等待全部完成

3. **Phase 3 — 整合输出**（顺序）
   - Agent: `writer` (方案撰写员)
   - 输入: Phase 1 + Phase 2 的全部产出
   - 输出: `04-最终方案.md`

### 5.2 头脑风暴模式

- 指定的 N 个角色并行提出观点
- 多轮迭代：每轮每个 Agent 可以看到其他 Agent 上一轮的输出
- 最后由 writer Agent 汇总所有观点，输出综合报告
- 轮数通过 `config.rounds` 配置，默认 3

### 5.3 会话状态机

```
created → running → completed
              ├→ paused → running (恢复)
              ├→ failed
              └→ cancelled
```

---

## 6. Agent 系统

### 6.1 Agent Runner

每个 Agent 对应一个 Claude CLI 子进程：

```python
class AgentRunner:
    async def run(self, agent_def, task, input_files, session_dir) -> AgentResult:
        # 1. 创建临时工作目录: /tmp/agentoffice/{session}/{agent}/
        # 2. 复制输入文件到工作目录
        # 3. 构建 system prompt (YAML定义 + 输出规范)
        # 4. 启动: claude -p "{prompt}" --output-format stream-json --max-turns 20
        # 5. 流式读取 stdout，解析 JSON 事件
        # 6. 通过 WebSocket 广播 agent:thinking/working/output 事件
        # 7. 进程结束后扫描输出文件，复制到 Vault session 目录
        # 8. 清理临时工作目录，返回 AgentResult
```

### 6.2 CLI 调用

```bash
claude -p "<system_prompt>\n\n## 任务\n<task>" \
  --output-format stream-json \
  --max-turns 20
```

- `--output-format stream-json`：每行一个 JSON 事件
- `--max-turns 20`：限制最大交互轮数
- 不传 `--allowedTools`，使用 Claude Code 默认工具集

### 6.3 输出解析

从 `stream-json` 输出提取事件：

| CLI 输出 type | 提取内容 | 映射 WS 事件 |
|---------------|---------|-------------|
| `assistant` + subtype `text` | 推理文本片段 | `agent:thinking` |
| `assistant` + subtype `tool_use` | 工具调用 | `agent:working` |
| `tool_result` (Write 工具) | 文件写入 | `agent:output` |
| `result` + subtype `success` | 最终结果 | `agent:completed` |
| `result` + subtype `error` | 错误信息 | `agent:failed` |

### 6.4 进程池

```python
class AgentPool:
    def __init__(self, max_concurrent=5, timeout=300, retry_count=1):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.timeout = timeout
        self.retry_count = retry_count

    async def submit(self, runner: AgentRunner) -> AgentResult:
        async with self.semaphore:
            for attempt in range(self.retry_count + 1):
                try:
                    return await asyncio.wait_for(
                        runner.run(), timeout=self.timeout
                    )
                except asyncio.TimeoutError:
                    await runner.kill()
                    if attempt == self.retry_count:
                        raise AgentTimeoutError
```

- 并发上限默认 5，通过 `asyncio.Semaphore` 控制
- 单 Agent 超时 300 秒
- 失败自动重试 1 次

### 6.5 Agent 定义 (YAML)

位于 `vault/agents/` 目录，启动时加载：

```yaml
# vault/agents/analyst.yaml
name: 需求分析师
id: analyst
model: claude-sonnet-4-20250514
max_turns: 20

system_prompt: |
  你是一位资深需求分析师。你的任务是：
  1. 理解用户提交的原始需求
  2. 用 5W2H 框架分析需求
  3. 识别不确定性和风险点
  4. 输出结构化的需求澄清文档

output_file: "01-需求澄清.md"
output_template: |
  ## 需求摘要
  ## 用户故事
  ## 功能需求
  ## 待确认问题
```

四个默认 Agent：
- `analyst` — 需求分析师
- `architect` — 方案架构师
- `researcher` — 资料研究员
- `writer` — 方案撰写员

---

## 7. Vault 数据存储

### 7.1 目录结构

```
vault/
├── agents/                        # Agent 角色定义 (YAML)
│   ├── analyst.yaml
│   ├── architect.yaml
│   ├── researcher.yaml
│   └── writer.yaml
│
├── sessions/                      # 会话存储
│   └── {session_id}/
│       ├── meta.yaml             # 会话元数据
│       ├── 00-原始需求.md         # 用户输入
│       ├── 01-需求澄清.md         # Phase 1 产出
│       ├── 02-技术方案.md         # Phase 2a 产出
│       ├── 03-参考资料.md         # Phase 2b 产出
│       └── 04-最终方案.md         # Phase 3 产出
│
└── kanban/
    └── active.md                 # 当前活跃任务
```

### 7.2 会话元数据 (meta.yaml)

```yaml
id: "20260413-153000-abc"
status: "running"
mode: "default"
created_at: "2026-04-13T15:30:00"
updated_at: "2026-04-13T15:32:00"

input:
  requirement: "设计一个电商系统"

phases:
  - id: 1
    name: "需求分析"
    status: "completed"
    agents: ["analyst"]
    started_at: "2026-04-13T15:30:00"
    completed_at: "2026-04-13T15:31:00"
    outputs: ["01-需求澄清.md"]
  - id: 2
    name: "方案设计"
    status: "running"
    agents: ["architect", "researcher"]
    started_at: "2026-04-13T15:31:00"
    outputs: []
  - id: 3
    name: "整合输出"
    status: "pending"
    agents: ["writer"]
    outputs: []
```

---

## 8. 配置管理

`settings.yaml`:

```yaml
server:
  host: "0.0.0.0"
  port: 8000
  cors_origins: ["http://localhost:3000"]

agent:
  max_concurrent: 5
  timeout_seconds: 300
  retry_count: 1
  work_dir: "/tmp/agentoffice"

vault:
  path: "./vault"

workflow:
  default_mode: "default"
  brainstorm_rounds: 3

logging:
  level: "INFO"
  file: "./logs/agentoffice.log"
```

使用 Pydantic BaseModel 定义 schema，支持环境变量覆盖。

---

## 9. 错误处理

| 场景 | 处理策略 |
|------|---------|
| Agent 超时 (300s) | SIGTERM → 等 5s → SIGKILL；标记 phase:failed |
| CLI 进程崩溃 | 捕获非零退出码；自动重试 1 次 |
| 输出文件缺失 | 标记 warning，phase 仍标记 completed |
| API 限流 | 信号量排队；超出上限返回 503 |
| Supervisor 重启 | 扫描 running 状态 session，标记为 interrupted |

---

## 10. 组件依赖关系

```
FastAPI App
├── API Router → SessionService → WorkflowEngine
├── WS Manager ← WorkflowEngine (广播事件)
└── WorkflowEngine
    ├── AgentPool → AgentRunner → Claude CLI
    └── VaultManager → 文件系统 (Obsidian Vault)
```

所有组件通过 FastAPI 依赖注入连接。Config 注入到所有组件。

---

## 11. 开发命令

```bash
cd backend && uv sync                                          # 安装依赖
uv run uvicorn app.main:app --reload --port 8000              # 开发服务器
uv run pytest tests/ -v                                        # 测试
open http://localhost:8000/docs                                # API 文档
```

---

## 12. 第一阶段与第二阶段边界

**第一阶段交付物**（本文档范围）：
- 完整的后端 API + WebSocket
- 四角色默认工作流 + 头脑风暴模式
- Obsidian Vault 数据存储
- 可通过 FastAPI Swagger UI 和 WebSocket 客户端完整测试

**第二阶段（前端可视化）接口约定**：
- 所有数据通过 REST API 获取
- 实时状态通过 WebSocket `/ws/sessions/{id}` 推送
- 前端只需对接 API，无需了解后端内部实现

**前端技术参考 — 斯坦福小镇 (AI Town)**：
- 参考仓库：[a16z-infra/ai-town](https://github.com/a16z-infra/ai-town)
- 核心参考内容：
  - **PixiJS 渲染架构**：2D 像素风格地图、角色 Sprite 管理、相机视口控制
  - **角色动画系统**：四方向行走/工作/思考状态动画、SpriteSheet 切换
  - **实时交互**：角色移动轨迹绘制、对话气泡、状态指示器
  - **地图系统**：Tiled 地图编辑器导出 JSON、碰撞检测、路径寻路
  - **游戏性交互**：点击角色查看详情、拖拽视角、缩放地图、观察 Agent 实时行为
- 技术栈：React 18 + PixiJS + Tailwind CSS + Socket.io-client
- 素材规范：32x32 像素 SpriteSheet，PNG 透明背景，idle/walk/work/think 四种动画状态
- 目标：不是静态数据面板，而是类似游戏世界的沉浸式交互体验
