# Virtual Office 布局重设计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端从 4 房间布局改为 Virtual Office 公司风格（十字走廊 + 研发部圆桌 + 两个装修中房间），后端新增 dev-lead/test-lead agent。

**Architecture:** 前端重写 mapConfig 和 agentConfig，OfficeMap 新增圆桌和装修中房间绘制逻辑。后端将 writer 改为 test-lead、新增 dev-lead YAML，workflow 从 3 阶段扩展为 4 阶段。测试同步更新。

**Tech Stack:** React 18 + PixiJS 7 + TypeScript（前端），FastAPI + Pydantic + YAML（后端），pytest-asyncio（测试）

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/data/mapConfig.ts` | 24×18 地图、3 房间（rd/marketing/finance）、新家具类型 |
| Modify | `frontend/src/data/agentConfig.ts` | 4 agent 配置（删除 writer，新增 dev-lead/test-lead） |
| Modify | `frontend/src/components/canvas/OfficeMap.tsx` | 十字走廊、圆桌、装修中房间绘制 |
| Modify | `frontend/src/components/canvas/AgentSprite.tsx` | AGENT_NAMES 更新（writer → test-lead + dev-lead） |
| Modify | `frontend/src/components/canvas/PixiCanvas.tsx` | 无需改动（从 MAP_CONFIG 动态读取尺寸） |
| Modify | `frontend/src/components/overlay/AgentDetailPanel.tsx` | AGENT_NAMES/AGENT_COLORS 更新 |
| Rename+Modify | `vault/agents/writer.yaml` → `vault/agents/test-lead.yaml` | 测试负责人定义 |
| Create | `vault/agents/dev-lead.yaml` | 开发负责人定义 |
| Modify | `backend/app/workflow/models.py` | 4 阶段工作流定义 |
| Modify | `backend/app/workflow/engine.py` | 4 阶段执行逻辑 |
| Modify | `backend/tests/test_models.py` | 更新阶段数断言 |
| Modify | `backend/tests/test_workflow.py` | 更新 agent 和阶段断言 |
| Modify | `backend/tests/test_api.py` | 更新 agent YAML fixtures |

---

### Task 1: 后端 — 新增 dev-lead agent YAML

**Files:**
- Create: `vault/agents/dev-lead.yaml`

- [ ] **Step 1: 创建 dev-lead.yaml**

```yaml
name: "开发负责人"
id: "dev-lead"
model: "claude-sonnet-4-20250514"
max_turns: 20
system_prompt: |
  你是一位资深开发负责人。你的任务是：
  1. 阅读需求澄清文档和技术方案
  2. 将技术方案分解为具体的开发任务
  3. 评估每个任务的复杂度和优先级
  4. 制定迭代计划和里程碑
  5. 识别技术风险和依赖关系

  输出格式要求：
  - Markdown 格式
  - 包含：任务总览、任务分解（含优先级和复杂度）、迭代计划、依赖关系、风险点
output_file: "03-开发任务.md"
output_template: |
  ## 任务总览
  ## 任务分解
  ### P0 - 核心任务
  ### P1 - 重要任务
  ### P2 - 优化任务
  ## 迭代计划
  ## 依赖关系
  ## 风险点
casual_prompt: |
  你是一位开发负责人。现在有个简单的问题需要你以自己的专业视角回应。
  请用轻松对话的方式回答，不需要写正式文档。保持你作为开发负责人的特色——关注技术实现、任务分解和工程实践。
```

- [ ] **Step 2: 验证 YAML 加载**

Run: `cd backend && uv run python -c "from app.vault.manager import VaultManager; vm = VaultManager('vault'); vm.ensure_structure(); defs = vm.load_agent_definitions(); print([d.id for d in defs])"`
Expected: 输出包含 `dev-lead`

- [ ] **Step 3: Commit**

```bash
git add vault/agents/dev-lead.yaml
git commit -m "feat: add dev-lead agent YAML definition"
```

---

### Task 2: 后端 — 重命名 writer 为 test-lead

**Files:**
- Rename: `vault/agents/writer.yaml` → `vault/agents/test-lead.yaml`
- Modify: `vault/agents/test-lead.yaml`

- [ ] **Step 1: 重命名文件**

```bash
git mv vault/agents/writer.yaml vault/agents/test-lead.yaml
```

- [ ] **Step 2: 修改 test-lead.yaml 内容**

将整个文件内容替换为：

```yaml
name: "测试负责人"
id: "test-lead"
model: "claude-sonnet-4-20250514"
max_turns: 25
system_prompt: |
  你是一位资深测试负责人。你的任务是：
  1. 阅读需求澄清文档、技术方案和开发任务分解
  2. 设计测试策略和测试计划
  3. 识别关键测试场景和边界条件
  4. 制定验收标准
  5. 评估质量风险

  输出格式要求：
  - Markdown 格式
  - 包含：测试策略、测试用例设计、验收标准、质量风险评估
output_file: "04-测试计划.md"
output_template: |
  ## 测试策略
  ## 测试用例设计
  ### 功能测试
  ### 边界测试
  ### 性能测试
  ## 验收标准
  ## 质量风险评估
casual_prompt: |
  你是一位测试负责人。现在有个简单的问题需要你以自己的专业视角回应。
  请用轻松对话的方式回答，不需要写正式文档。保持你作为测试负责人的特色——关注质量保障、边界场景和验收标准。
```

- [ ] **Step 3: 验证 YAML 加载**

Run: `cd backend && uv run python -c "from app.vault.manager import VaultManager; vm = VaultManager('vault'); vm.ensure_structure(); defs = vm.load_agent_definitions(); ids = [d.id for d in defs]; print(ids); assert 'test-lead' in ids; assert 'writer' not in ids; print('OK')"`
Expected: 输出包含 test-lead，不包含 writer，末尾显示 OK

- [ ] **Step 4: Commit**

```bash
git add vault/agents/test-lead.yaml
git commit -m "feat: rename writer agent to test-lead with testing role"
```

---

### Task 3: 后端 — 更新 workflow models 4 阶段

**Files:**
- Modify: `backend/app/workflow/models.py`

- [ ] **Step 1: 修改 Session.from_request 方法**

在 `models.py` 第 66-83 行，将 `from_request` 方法中的 default 模式阶段从 3 阶段改为 4 阶段，brainstorm 模式中 writer 改为 test-lead：

```python
    @classmethod
    def from_request(cls, req: CreateSessionRequest, session_id: str) -> "Session":
        if req.mode == SessionMode.DEFAULT:
            phases = [
                Phase(id=1, name="需求分析", agents=["analyst"]),
                Phase(id=2, name="方案设计", agents=["architect"]),
                Phase(id=3, name="开发任务", agents=["dev-lead"]),
                Phase(id=4, name="测试计划", agents=["test-lead"]),
            ]
        else:
            agents = req.agents or ["analyst", "architect"]
            phases = [
                Phase(id=1, name="头脑风暴", agents=agents),
                Phase(id=2, name="整合输出", agents=["test-lead"]),
            ]
        return cls(
            id=session_id,
            mode=req.mode,
            input_requirement=req.requirement,
            phases=phases,
        )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/workflow/models.py
git commit -m "feat: update workflow to 4-phase with dev-lead and test-lead"
```

---

### Task 4: 后端 — 更新 workflow engine 4 阶段执行

**Files:**
- Modify: `backend/app/workflow/engine.py`

- [ ] **Step 1: 修改 _run_default_workflow 方法**

将 `engine.py` 第 178-193 行的 `_run_default_workflow` 方法更新为 4 阶段：

```python
    async def _run_default_workflow(self, session: Session) -> None:
        """Run the default 4-phase workflow."""
        session_dir = self.vault_manager._sessions_path / session.id

        # Phase 1: analyst (sequential)
        phase = session.phases[0]
        await self._run_phase(session, phase, "请分析以下需求并输出需求澄清文档。", session_dir)

        # Phase 2: architect (sequential)
        phase = session.phases[1]
        await self._run_parallel_phase(session, phase, session_dir)

        # Phase 3: dev-lead (sequential)
        phase = session.phases[2]
        task = "请阅读所有前置文档，将技术方案分解为开发任务。"
        await self._run_phase(session, phase, task, session_dir)

        # Phase 4: test-lead (sequential)
        phase = session.phases[3]
        task = "请阅读所有前置文档，制定测试计划。"
        await self._run_phase(session, phase, task, session_dir)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/workflow/engine.py
git commit -m "feat: update engine to run 4-phase workflow"
```

---

### Task 5: 后端 — 更新测试

**Files:**
- Modify: `backend/tests/test_models.py`
- Modify: `backend/tests/test_workflow.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: 更新 test_models.py**

修改第 51 行 `test_session_from_request`，将断言从 3 阶段改为 4 阶段：

```python
def test_session_from_request():
    req = CreateSessionRequest(requirement="test requirement")
    session = Session.from_request(req, "20260413-153000-abc")
    assert session.id == "20260413-153000-abc"
    assert session.status == SessionStatus.CREATED
    assert session.input_requirement == "test requirement"
    assert len(session.phases) == 4  # default mode has 4 phases
```

- [ ] **Step 2: 更新 test_workflow.py**

修改 `_create_agent_yamls` 函数（第 17-27 行），将 writer 改为 dev-lead + test-lead：

```python
def _create_agent_yamls(agents_dir: Path) -> None:
    """Create minimal agent YAML definitions for testing."""
    import yaml
    agents = [
        {"id": "analyst", "name": "需求分析师", "system_prompt": "You are an analyst."},
        {"id": "architect", "name": "架构师", "system_prompt": "You are an architect."},
        {"id": "dev-lead", "name": "开发负责人", "system_prompt": "You are a dev lead."},
        {"id": "test-lead", "name": "测试负责人", "system_prompt": "You are a test lead."},
    ]
    for agent in agents:
        path = agents_dir / f"{agent['id']}.yaml"
        path.write_text(yaml.dump(agent, allow_unicode=True), encoding="utf-8")
```

修改 `test_run_default_workflow_phases`（第 59-71 行），将 pool.submit 调用次数从 3 改为 4：

```python
@pytest.mark.asyncio
async def test_run_default_workflow_phases(engine: WorkflowEngine):
    """Default workflow runs 4 phases in order."""
    req = CreateSessionRequest(requirement="test")

    engine.pool.submit = AsyncMock(return_value=AgentResult(
        agent_id="agent", success=True, output_files=["out.md"], duration_ms=100,
    ))

    session = engine.create_session(req)
    await engine.execute_session(session)

    # Should have called pool.submit once per agent (4 total)
    assert engine.pool.submit.call_count == 4
```

修改 `test_phase_2_runs_parallel`（第 75-98 行），将 writer 引用改为 test-lead：

```python
@pytest.mark.asyncio
async def test_phase_2_runs_parallel(engine: WorkflowEngine):
    """Phase 2 runs architect agent."""
    req = CreateSessionRequest(requirement="test")

    call_order = []

    async def track_submit(runner, task, event_callback=None):
        call_order.append(runner.agent_def.id)
        await asyncio.sleep(0.05)  # simulate work
        return AgentResult(
            agent_id=runner.agent_def.id, success=True,
            output_files=["out.md"], duration_ms=50,
        )

    engine.pool.submit = track_submit

    session = engine.create_session(req)
    await engine.execute_session(session)

    # Phase 2 agents should overlap (not strictly sequential)
    assert "architect" in call_order
    assert "test-lead" in call_order
    assert call_order.index("test-lead") > call_order.index("architect")
```

- [ ] **Step 3: 更新 test_api.py**

修改 `_create_agent_yamls` 函数（第 13-23 行）：

```python
def _create_agent_yamls(agents_dir) -> None:
    """Create minimal agent YAML definitions for testing."""
    import yaml
    agents = [
        {"id": "analyst", "name": "需求分析师", "system_prompt": "You are an analyst."},
        {"id": "architect", "name": "架构师", "system_prompt": "You are an architect."},
        {"id": "dev-lead", "name": "开发负责人", "system_prompt": "You are a dev lead."},
        {"id": "test-lead", "name": "测试负责人", "system_prompt": "You are a test lead."},
    ]
    for agent in agents:
        path = agents_dir / f"{agent['id']}.yaml"
        path.write_text(yaml.dump(agent, allow_unicode=True), encoding="utf-8")
```

- [ ] **Step 4: 运行后端全部测试**

Run: `cd backend && uv run pytest -v`
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_models.py backend/tests/test_workflow.py backend/tests/test_api.py
git commit -m "test: update tests for 4-phase workflow with dev-lead and test-lead"
```

---

### Task 6: 前端 — 重写 mapConfig.ts

**Files:**
- Modify: `frontend/src/data/mapConfig.ts`

- [ ] **Step 1: 替换整个 mapConfig.ts**

```typescript
export interface FurnitureItem {
  type: 'desk' | 'chair' | 'whiteboard' | 'screen' | 'bookshelf' | 'cabinet' | 'lamp' | 'round_table' | 'covered';
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}

export interface RoomDef {
  id: string;
  name: string;
  phase: number | null;
  agents: string[];
  bounds: { x: number; y: number; width: number; height: number };
  seats: Record<string, { x: number; y: number }>;
  floorColor: number;
  status: 'active' | 'renovating';
  furniture: FurnitureItem[];
}

// 24x18 tile map (768x576 pixels)
// Layout: T-shaped corridor connecting 3 rooms
//   rd (top center), marketing (bottom left), finance (bottom right)

export const ROOMS: RoomDef[] = [
  {
    id: 'rd',
    name: '研发部',
    phase: 1,
    agents: ['analyst', 'architect', 'dev-lead', 'test-lead'],
    bounds: { x: 7, y: 0, width: 10, height: 9 },
    seats: {
      analyst: { x: 11, y: 3 },
      architect: { x: 14, y: 5 },
      'dev-lead': { x: 11, y: 7 },
      'test-lead': { x: 8, y: 5 },
    },
    floorColor: 0x1a2e1a,
    status: 'active',
    furniture: [
      // Round table in center of room
      { type: 'round_table', x: 10, y: 4, width: 3, height: 3, color: 0x6b5b47 },
      // Chairs around table
      { type: 'chair', x: 11, y: 3, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 14, y: 5, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 11, y: 7, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 8, y: 5, width: 1, height: 1, color: 0x555566 },
      // Whiteboard on right wall
      { type: 'whiteboard', x: 16, y: 2, width: 1, height: 4, color: 0xeeeeee },
      // Screen on top wall
      { type: 'screen', x: 11, y: 0, width: 2, height: 1, color: 0x334455 },
    ],
  },
  {
    id: 'marketing',
    name: '市场部',
    phase: null,
    agents: [],
    bounds: { x: 0, y: 12, width: 9, height: 6 },
    seats: {},
    floorColor: 0x2a2a3a,
    status: 'renovating',
    furniture: [
      { type: 'covered', x: 1, y: 13, width: 3, height: 1, color: 0x444444 },
      { type: 'covered', x: 5, y: 13, width: 2, height: 1, color: 0x444444 },
      { type: 'covered', x: 1, y: 15, width: 2, height: 1, color: 0x444444 },
    ],
  },
  {
    id: 'finance',
    name: '财务部',
    phase: null,
    agents: [],
    bounds: { x: 15, y: 12, width: 9, height: 6 },
    seats: {},
    floorColor: 0x2a2a3a,
    status: 'renovating',
    furniture: [
      { type: 'covered', x: 16, y: 13, width: 3, height: 1, color: 0x444444 },
      { type: 'covered', x: 20, y: 13, width: 2, height: 1, color: 0x444444 },
      { type: 'covered', x: 16, y: 15, width: 2, height: 1, color: 0x444444 },
    ],
  },
];

export const MAP_CONFIG = {
  tileWidth: 32,
  tileHeight: 32,
  mapWidth: 24,
  mapHeight: 18,
  companyName: 'Virtual Office',
  corridorColor: 0x222233,
  wallColor: 0x1a1a2a,
  wallThickness: 3,
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/data/mapConfig.ts
git commit -m "feat: rewrite mapConfig for Virtual Office T-corridor layout"
```

---

### Task 7: 前端 — 更新 agentConfig.ts

**Files:**
- Modify: `frontend/src/data/agentConfig.ts`

- [ ] **Step 1: 替换整个 agentConfig.ts**

```typescript
export interface AgentVisualConfig {
  agentId: string;
  spriteKey: string;
  spriteUrl: string;
  room: string;
  /** Position in room (tile coordinates) */
  position: { x: number; y: number };
  /** Home position (same as position, used for returning after tasks) */
  homePosition: { x: number; y: number };
  /** Animation speed for different states (frames per second) */
  animationSpeed: {
    idle: number;
    walking: number;
    working: number;
    thinking: number;
  };
}

export const AGENT_CONFIGS: Record<string, AgentVisualConfig> = {
  analyst: {
    agentId: 'analyst',
    spriteKey: 'f1',
    spriteUrl: '/assets/32x32folk.png',
    room: 'rd',
    position: { x: 11, y: 3 },
    homePosition: { x: 11, y: 3 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
  architect: {
    agentId: 'architect',
    spriteKey: 'f4',
    spriteUrl: '/assets/32x32folk.png',
    room: 'rd',
    position: { x: 14, y: 5 },
    homePosition: { x: 14, y: 5 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
  'dev-lead': {
    agentId: 'dev-lead',
    spriteKey: 'f6',
    spriteUrl: '/assets/32x32folk.png',
    room: 'rd',
    position: { x: 11, y: 7 },
    homePosition: { x: 11, y: 7 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
  'test-lead': {
    agentId: 'test-lead',
    spriteKey: 'f3',
    spriteUrl: '/assets/32x32folk.png',
    room: 'rd',
    position: { x: 8, y: 5 },
    homePosition: { x: 8, y: 5 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/data/agentConfig.ts
git commit -m "feat: update agent configs for 4 agents in rd room"
```

---

### Task 8: 前端 — 更新 AgentSprite.tsx

**Files:**
- Modify: `frontend/src/components/canvas/AgentSprite.tsx`

- [ ] **Step 1: 更新 AGENT_NAMES 映射**

将第 19-23 行的 `AGENT_NAMES` 替换为：

```typescript
const AGENT_NAMES: Record<string, string> = {
  analyst: '需求分析师',
  architect: '方案架构师',
  'dev-lead': '开发负责人',
  'test-lead': '测试负责人',
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/canvas/AgentSprite.tsx
git commit -m "feat: update AgentSprite names for dev-lead and test-lead"
```

---

### Task 9: 前端 — 更新 AgentDetailPanel.tsx

**Files:**
- Modify: `frontend/src/components/overlay/AgentDetailPanel.tsx`

- [ ] **Step 1: 更新 AGENT_NAMES 和 AGENT_COLORS**

将第 4-14 行替换为：

```typescript
const AGENT_NAMES: Record<string, string> = {
  analyst: '需求分析师',
  architect: '方案架构师',
  'dev-lead': '开发负责人',
  'test-lead': '测试负责人',
};

const AGENT_COLORS: Record<string, string> = {
  analyst: 'text-green-400',
  architect: 'text-blue-400',
  'dev-lead': 'text-orange-400',
  'test-lead': 'text-purple-400',
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/overlay/AgentDetailPanel.tsx
git commit -m "feat: update AgentDetailPanel for dev-lead and test-lead"
```

---

### Task 10: 前端 — 重写 OfficeMap.tsx

**Files:**
- Modify: `frontend/src/components/canvas/OfficeMap.tsx`

- [ ] **Step 1: 替换整个 OfficeMap.tsx**

```typescript
import { useEffect } from 'react';
import { Graphics } from 'pixi.js';
import { Text } from '@pixi/text';
import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';
import { useViewport } from './PixiCanvas';
import type { FurnitureItem } from '../../data/mapConfig';

const { tileWidth, tileHeight, mapWidth, mapHeight, corridorColor, wallColor, wallThickness } = MAP_CONFIG;

function drawDesk(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth + 2;
  const py = item.y * tileHeight + 2;
  const pw = item.width * tileWidth - 4;
  const ph = item.height * tileHeight - 4;
  g.beginFill(item.color);
  g.drawRoundedRect(px, py, pw, ph, 2);
  g.endFill();
}

function drawChair(g: Graphics, item: FurnitureItem) {
  const cx = (item.x + item.width / 2) * tileWidth;
  const cy = (item.y + item.height / 2) * tileHeight;
  const radius = (Math.min(item.width * tileWidth, item.height * tileHeight) / 2) * 0.6;
  g.beginFill(item.color);
  g.drawCircle(cx, cy, radius);
  g.endFill();
}

function drawWhiteboard(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth;
  const py = item.y * tileHeight;
  const pw = item.width * tileWidth;
  const ph = item.height * tileHeight;
  g.beginFill(item.color);
  g.drawRect(px, py, pw, ph);
  g.endFill();
  g.beginFill(0xffffff, 0.15);
  g.drawRect(px + 2, py + 2, pw - 4, ph - 4);
  g.endFill();
}

function drawScreen(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth;
  const py = item.y * tileHeight;
  const pw = item.width * tileWidth;
  const ph = item.height * tileHeight;
  g.beginFill(item.color);
  g.drawRect(px, py, pw, ph);
  g.endFill();
  g.beginFill(0x88bbff, 0.3);
  g.drawRect(px + 2, py + 2, pw - 4, ph - 4);
  g.endFill();
}

function drawRoundTable(g: Graphics, item: FurnitureItem) {
  const cx = (item.x + item.width / 2) * tileWidth;
  const cy = (item.y + item.height / 2) * tileHeight;
  const rx = (item.width * tileWidth) / 2 - 4;
  const ry = (item.height * tileHeight) / 2 - 4;
  // Table surface
  g.beginFill(item.color);
  g.drawEllipse(cx, cy, rx, ry);
  g.endFill();
  // Wood grain highlight
  g.beginFill(0x7d6d57, 0.3);
  g.drawEllipse(cx, cy, rx * 0.7, ry * 0.7);
  g.endFill();
}

function drawCovered(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth;
  const py = item.y * tileHeight;
  const pw = item.width * tileWidth;
  const ph = item.height * tileHeight;
  // Dark shape
  g.beginFill(item.color);
  g.drawRoundedRect(px + 1, py + 1, pw - 2, ph - 2, 2);
  g.endFill();
  // Cloth drape lines
  g.lineStyle(1, 0x555555, 0.4);
  const midY = py + ph / 2;
  g.moveTo(px + 3, midY - 3);
  g.lineTo(px + pw - 3, midY - 3);
  g.moveTo(px + 3, midY + 3);
  g.lineTo(px + pw - 3, midY + 3);
  g.lineStyle(0);
}

function drawFurniture(g: Graphics, item: FurnitureItem) {
  switch (item.type) {
    case 'desk':
      drawDesk(g, item);
      break;
    case 'chair':
      drawChair(g, item);
      break;
    case 'whiteboard':
      drawWhiteboard(g, item);
      break;
    case 'screen':
      drawScreen(g, item);
      break;
    case 'round_table':
      drawRoundTable(g, item);
      break;
    case 'covered':
      drawCovered(g, item);
      break;
  }
}

export function OfficeMap() {
  const viewport = useViewport();

  useEffect(() => {
    if (!viewport) return;

    const container = new Graphics();

    // 1. Corridor background (entire map area)
    container.beginFill(corridorColor);
    container.drawRect(0, 0, mapWidth * tileWidth, mapHeight * tileHeight);
    container.endFill();

    // 2. T-shaped corridor: vertical from rd down, horizontal connecting marketing/finance
    // Vertical corridor (center, below rd)
    container.beginFill(corridorColor);
    container.drawRect(10 * tileWidth, 9 * tileHeight, 4 * tileWidth, 3 * tileHeight);
    container.endFill();
    // Horizontal corridor (connecting left and right)
    container.beginFill(corridorColor);
    container.drawRect(0, 10 * tileHeight, mapWidth * tileWidth, 2 * tileHeight);
    container.endFill();

    // 3. Company name at top
    const companyLabel = new Text(MAP_CONFIG.companyName, {
      fontFamily: 'sans-serif',
      fontSize: 18,
      fill: 0x667788,
      fontWeight: 'bold',
      align: 'center',
    });
    companyLabel.anchor.set(0.5);
    companyLabel.x = (mapWidth / 2) * tileWidth;
    companyLabel.y = 0.5 * tileHeight;
    container.addChild(companyLabel);

    // 4. Draw each room
    for (const room of ROOMS) {
      const { x, y, width, height } = room.bounds;
      const rx = x * tileWidth;
      const ry = y * tileHeight;
      const rw = width * tileWidth;
      const rh = height * tileHeight;

      // Floor
      container.beginFill(room.floorColor);
      container.drawRect(rx, ry, rw, rh);
      container.endFill();

      if (room.status === 'renovating') {
        // Dashed walls
        container.lineStyle(wallThickness, wallColor, 0.5);
        container.drawRect(rx, ry, rw, rh);
        container.lineStyle(0);

        // Semi-transparent overlay
        container.beginFill(0x000000, 0.2);
        container.drawRect(rx, ry, rw, rh);
        container.endFill();

        // Furniture (covered items)
        for (const item of room.furniture) {
          drawFurniture(container, item);
        }

        // "装修中" sign
        const sign = new Text('🔒 装修中', {
          fontFamily: 'sans-serif',
          fontSize: 12,
          fill: 0x888888,
          align: 'center',
        });
        sign.anchor.set(0.5);
        sign.x = (x + width / 2) * tileWidth;
        sign.y = (y + height / 2) * tileHeight;
        container.addChild(sign);

        // Room name below sign
        const label = new Text(room.name, {
          fontFamily: 'sans-serif',
          fontSize: 11,
          fill: 0x666666,
          align: 'center',
        });
        label.anchor.set(0.5);
        label.x = (x + width / 2) * tileWidth;
        label.y = (y + height / 2 + 1) * tileHeight;
        container.addChild(label);
      } else {
        // Solid walls for active rooms
        container.lineStyle(wallThickness, wallColor, 1);
        container.drawRect(rx, ry, rw, rh);
        container.lineStyle(0);

        // Furniture
        for (const item of room.furniture) {
          drawFurniture(container, item);
        }

        // Room name label
        const label = new Text(room.name, {
          fontFamily: 'sans-serif',
          fontSize: 14,
          fill: 0x88aa88,
          align: 'center',
        });
        label.anchor.set(0.5);
        label.x = (x + width / 2) * tileWidth;
        label.y = (y + 0.6) * tileHeight;
        container.addChild(label);
      }
    }

    viewport.addChild(container);

    return () => {
      viewport.removeChild(container);
      container.destroy({ children: true });
    };
  }, [viewport]);

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/canvas/OfficeMap.tsx
git commit -m "feat: rewrite OfficeMap with T-corridor, round table, and renovating rooms"
```

---

### Task 11: 前端 — 验证编译

**Files:** 无变更，验证阶段

- [ ] **Step 1: 运行前端构建**

Run: `cd frontend && npm run build`
Expected: 无 TypeScript 编译错误

- [ ] **Step 2: 如有编译错误，逐一修复后重新构建**

常见问题：
- `MAP_CONFIG.companyName` 类型不匹配 → 检查 mapConfig.ts 导出
- `room.status` 属性不存在 → 检查 RoomDef 接口是否包含 `status` 字段

---

### Task 12: 集成验证

**Files:** 无变更，端到端验证

- [ ] **Step 1: 启动后端**

Run: `cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

- [ ] **Step 2: 启动前端**

Run: `cd frontend && npm run dev`

- [ ] **Step 3: 在浏览器中验证**

打开 http://localhost:3000，检查：
1. Virtual Office 标题显示在地图顶部
2. 研发部房间可见，4 个 agent 围坐圆桌
3. 市场部和财务部显示虚线墙壁 + "装修中" 标牌
4. T 形走廊连接三个房间
5. 点击 agent 可打开详情面板
6. StatusBar 可打开 ArchiveDrawer
