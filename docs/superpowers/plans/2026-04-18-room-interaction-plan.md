# Room Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interactive filing cabinets and clickable desks to active rooms, with backend support for room-scoped agent filtering.

**Architecture:** Backend adds `room` as a required field to session creation and filters agents by room. Frontend adds interactive furniture rendering in OfficeMap with click handlers wired to existing modal/drawer components. Global buttons removed from StatusBar.

**Tech Stack:** Python/FastAPI (backend), React/TypeScript/PixiJS/Zustand (frontend), pytest (backend tests), Vitest (frontend tests)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `vault/agents/*.yaml` | Modify | Add `room: rd` field to each agent |
| `backend/app/workflow/models.py` | Modify | Add `room` field to `CreateSessionRequest`, update `Session.from_request` |
| `backend/app/workflow/engine.py` | Modify | Add `_get_agents_by_room`, filter agents in workflow |
| `backend/app/vault/manager.py` | Modify | Add `load_agents_by_room` method |
| `backend/app/api/sessions.py` | Modify | Validate `room` is provided, pass to engine |
| `backend/tests/test_api.py` | Modify | Update tests to include `room` param, add validation test |
| `frontend/src/types.ts` | Modify | Add `room` to `CreateSessionRequest` |
| `frontend/src/data/mapConfig.ts` | Modify | Add `interactive` to `FurnitureItem`, add cabinet, mark round_table interactive |
| `frontend/src/stores/uiStore.ts` | Modify | Replace `archiveDrawerOpen` with `roomArchiveOpen`, update `openNewTaskModal` to accept roomId |
| `frontend/src/stores/sessionStore.ts` | Modify | Update `createSession` to accept `room` |
| `frontend/src/services/api.ts` | Modify | No change needed (already sends `CreateSessionRequest` body) |
| `frontend/src/components/canvas/OfficeMap.tsx` | Modify | Add `drawCabinet`, add interactive hit areas for task/archive furniture |
| `frontend/src/components/overlay/NewTaskModal.tsx` | Modify | Accept `roomId` prop, pass `room` in request |
| `frontend/src/components/overlay/ArchiveDrawer.tsx` | Modify | Accept `roomId` prop, filter sessions by room agents |
| `frontend/src/components/overlay/StatusBar.tsx` | Modify | Remove global "新任务" and "档案柜" buttons |

---

### Task 1: Backend — Add `room` field to agent YAMLs

**Files:**
- Modify: `vault/agents/analyst.yaml`
- Modify: `vault/agents/architect.yaml`
- Modify: `vault/agents/dev-lead.yaml`
- Modify: `vault/agents/test-lead.yaml`
- Modify: `vault/agents/moderator.yaml`

- [ ] **Step 1: Add `room: rd` to each agent YAML**

For `vault/agents/analyst.yaml`, add `room: rd` field after the `id` line:

```yaml
id: "analyst"
room: "rd"
```

Repeat for `architect.yaml`, `dev-lead.yaml`, `test-lead.yaml`, and `moderator.yaml` — all get `room: "rd"`.

- [ ] **Step 2: Verify YAML is valid**

Run: `cd backend && python -c "import yaml; [yaml.safe_load(open(f'../vault/agents/{f}', encoding='utf-8').read()) for f in ['analyst.yaml','architect.yaml','dev-lead.yaml','test-lead.yaml','moderator.yaml']]; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add vault/agents/analyst.yaml vault/agents/architect.yaml vault/agents/dev-lead.yaml vault/agents/test-lead.yaml vault/agents/moderator.yaml
git commit -m "feat: add room field to agent definitions"
```

---

### Task 2: Backend — Update `AgentDefinition` and `CreateSessionRequest` models

**Files:**
- Modify: `backend/app/workflow/models.py:87-95` (AgentDefinition)
- Modify: `backend/app/workflow/models.py:34-38` (CreateSessionRequest)
- Modify: `backend/app/workflow/models.py:65-84` (Session.from_request)

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_models.py` (or create if missing):

```python
def test_create_session_request_requires_room():
    """CreateSessionRequest must include room field."""
    from app.workflow.models import CreateSessionRequest
    import pydantic

    # Missing room should raise
    with pydantic.ValidationError:
        CreateSessionRequest(requirement="test", mode="default")

    # With room should succeed
    req = CreateSessionRequest(requirement="test", mode="default", room="rd")
    assert req.room == "rd"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_models.py::test_create_session_request_requires_room -v`
Expected: FAIL

- [ ] **Step 3: Add `room` field to `AgentDefinition`**

In `backend/app/workflow/models.py`, add `room` field to `AgentDefinition`:

```python
class AgentDefinition(BaseModel):
    name: str
    id: str
    model: str = "claude-sonnet-4-20250514"
    max_turns: int = 20
    system_prompt: str
    output_file: str | None = None
    output_template: str | None = None
    casual_prompt: str | None = None
    room: str = "rd"
```

- [ ] **Step 4: Add `room` as required field to `CreateSessionRequest`**

In `backend/app/workflow/models.py`, change `CreateSessionRequest`:

```python
class CreateSessionRequest(BaseModel):
    requirement: str
    mode: SessionMode = SessionMode.DEFAULT
    agents: list[str] | None = None
    room: str  # Required — always specifies which room's agents to use
    config: SessionConfig = Field(default_factory=SessionConfig)
```

- [ ] **Step 5: Update `Session.from_request` to accept room param**

No change needed to `Session.from_request` itself — the room-based filtering happens at the engine level (Task 3). The `from_request` method keeps its current phase structure.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_models.py::test_create_session_request_requires_room -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/workflow/models.py backend/tests/test_models.py
git commit -m "feat: add required room field to CreateSessionRequest and AgentDefinition"
```

---

### Task 3: Backend — Add room-based agent filtering

**Files:**
- Modify: `backend/app/vault/manager.py:24-33` (add `load_agents_by_room`)
- Modify: `backend/app/workflow/engine.py:47-56` (add `_get_agents_by_room`, update `create_session`)

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_vault.py`:

```python
def test_load_agents_by_room(tmp_vault):
    """load_agents_by_room returns only agents matching the room."""
    import yaml
    from app.vault.manager import VaultManager
    from pathlib import Path

    agents_dir = tmp_vault / "agents"
    agents_dir.mkdir(exist_ok=True)

    agents = [
        {"id": "analyst", "name": "分析师", "room": "rd", "system_prompt": "analyze"},
        {"id": "architect", "name": "架构师", "room": "rd", "system_prompt": "design"},
        {"id": "marketer", "name": "市场", "room": "marketing", "system_prompt": "market"},
    ]
    for agent in agents:
        path = agents_dir / f"{agent['id']}.yaml"
        path.write_text(yaml.dump(agent, allow_unicode=True), encoding="utf-8")

    vm = VaultManager(tmp_vault)
    rd_agents = vm.load_agents_by_room("rd")
    assert len(rd_agents) == 2
    assert all(a.room == "rd" for a in rd_agents)

    marketing_agents = vm.load_agents_by_room("marketing")
    assert len(marketing_agents) == 1

    empty = vm.load_agents_by_room("nonexistent")
    assert len(empty) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_vault.py::test_load_agents_by_room -v`
Expected: FAIL with `AttributeError: 'VaultManager' object has no attribute 'load_agents_by_room'`

- [ ] **Step 3: Add `load_agents_by_room` to VaultManager**

In `backend/app/vault/manager.py`, add after `load_agent_definitions` (after line 33):

```python
def load_agents_by_room(self, room_id: str) -> list[AgentDefinition]:
    """Load agent definitions filtered by room."""
    return [a for a in self.load_agent_definitions() if a.room == room_id]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_vault.py::test_load_agents_by_room -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/vault/manager.py backend/tests/test_vault.py
git commit -m "feat: add load_agents_by_room to VaultManager"
```

---

### Task 4: Backend — Validate `room` in API and filter agents in engine

**Files:**
- Modify: `backend/app/api/sessions.py:22-27` (validate room, check agents exist)
- Modify: `backend/app/workflow/engine.py:63-73` (accept room, filter agents)

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_api.py`:

```python
@pytest.mark.asyncio
async def test_create_session_without_room(client: AsyncClient):
    """POST /api/sessions without room returns 422."""
    resp = await client.post("/api/sessions", json={
        "requirement": "设计一个电商系统",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_session_with_room(client: AsyncClient):
    """POST /api/sessions with room creates session successfully."""
    resp = await client.post("/api/sessions", json={
        "requirement": "设计一个电商系统",
        "room": "rd",
    })
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["input_requirement"] == "设计一个电商系统"


@pytest.mark.asyncio
async def test_create_session_invalid_room(client: AsyncClient):
    """POST /api/sessions with nonexistent room returns 422."""
    resp = await client.post("/api/sessions", json={
        "requirement": "test",
        "room": "nonexistent",
    })
    assert resp.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_api.py::test_create_session_without_room tests/test_api.py::test_create_session_with_room tests/test_api.py::test_create_session_invalid_room -v`
Expected: FAIL (422 test may pass since Pydantic validates the required field; the invalid-room test should fail)

- [ ] **Step 3: Add room validation to `create_session` API endpoint**

In `backend/app/api/sessions.py`, update `create_session`:

```python
@router.post("/sessions", status_code=201)
async def create_session(req: CreateSessionRequest):
    assert _engine is not None
    agents = _engine.vault_manager.load_agents_by_room(req.room)
    if not agents:
        raise HTTPException(status_code=422, detail=f"No agents found for room '{req.room}'")
    session = _engine.create_session(req)
    asyncio.create_task(_engine.execute_session(session))
    return session.model_dump(mode="json")
```

- [ ] **Step 4: Update engine `create_session` to store room on session**

In `backend/app/workflow/engine.py`, update `create_session`:

```python
def create_session(self, req: CreateSessionRequest) -> Session:
    """Create a new session (sync, returns immediately)."""
    session_id = self._generate_session_id()
    session = Session.from_request(req, session_id)
    session.status = SessionStatus.RUNNING
    session.updated_at = datetime.now()
    self._sessions[session_id] = session

    self.vault_manager.create_session(session)
    self.vault_manager.update_session(session)
    return session
```

(No change needed here — filtering happens at API layer before calling `create_session`.)

- [ ] **Step 5: Update existing tests to include `room` param**

In `backend/tests/test_api.py`, update `_create_agent_yamls` to include `room`:

```python
def _create_agent_yamls(agents_dir) -> None:
    """Create minimal agent YAML definitions for testing."""
    import yaml
    agents = [
        {"id": "analyst", "name": "需求分析师", "system_prompt": "You are an analyst.", "room": "rd"},
        {"id": "architect", "name": "架构师", "system_prompt": "You are an architect.", "room": "rd"},
        {"id": "dev-lead", "name": "开发负责人", "system_prompt": "You are a dev lead.", "room": "rd"},
        {"id": "test-lead", "name": "测试负责人", "system_prompt": "You are a test lead.", "room": "rd"},
    ]
    for agent in agents:
        path = agents_dir / f"{agent['id']}.yaml"
        path.write_text(yaml.dump(agent, allow_unicode=True), encoding="utf-8")
```

Update ALL existing test cases in `test_api.py` that call `POST /api/sessions` to include `"room": "rd"` in the JSON body. For example:

- `test_create_session`: add `"room": "rd"`
- `test_list_sessions`: add `"room": "rd"`
- `test_get_session`: add `"room": "rd"`
- `test_get_outputs`: add `"room": "rd"`
- `test_delete_session`: add `"room": "rd"`
- `test_delete_running_session_conflict`: add `"room": "rd"`
- `test_delete_paused_session_conflict`: add `"room": "rd"`
- `test_delete_failed_session`: add `"room": "rd"`

- [ ] **Step 6: Run all backend tests**

Run: `cd backend && uv run pytest -v`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/sessions.py backend/app/workflow/engine.py backend/tests/test_api.py
git commit -m "feat: validate room param and filter agents by room in session creation"
```

---

### Task 5: Frontend — Update types and config

**Files:**
- Modify: `frontend/src/types.ts:27-32`
- Modify: `frontend/src/data/mapConfig.ts`

- [ ] **Step 1: Add `room` to `CreateSessionRequest` in types.ts**

In `frontend/src/types.ts`, update:

```typescript
export interface CreateSessionRequest {
  requirement: string;
  mode: SessionMode;
  room: string;
  agents?: string[] | null;
  config?: { rounds: number };
}
```

- [ ] **Step 2: Add `interactive` to `FurnitureItem` in mapConfig.ts**

In `frontend/src/data/mapConfig.ts`, update:

```typescript
export interface FurnitureItem {
  type: 'desk' | 'chair' | 'whiteboard' | 'screen' | 'bookshelf' | 'cabinet' | 'lamp' | 'round_table' | 'covered';
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  interactive?: 'task' | 'archive';
}
```

- [ ] **Step 3: Update R&D room furniture**

In `frontend/src/data/mapConfig.ts`, update the R&D room's furniture array:

```typescript
furniture: [
  { type: 'cabinet', x: 7, y: 0, width: 2, height: 2, color: 0x8B7355, interactive: 'archive' },
  { type: 'round_table', x: 10, y: 4, width: 3, height: 3, color: 0x6b5b47, interactive: 'task' },
  { type: 'chair', x: 11, y: 3, width: 1, height: 1, color: 0x555566 },
  { type: 'chair', x: 14, y: 5, width: 1, height: 1, color: 0x555566 },
  { type: 'chair', x: 11, y: 7, width: 1, height: 1, color: 0x555566 },
  { type: 'chair', x: 8, y: 5, width: 1, height: 1, color: 0x555566 },
  { type: 'whiteboard', x: 16, y: 2, width: 1, height: 4, color: 0xeeeeee },
  { type: 'screen', x: 11, y: 0, width: 2, height: 1, color: 0x334455 },
],
```

Note: the cabinet is placed at `x:7, y:0` (top-left corner of the room, which starts at `x:7, y:0`). The cabinet occupies 2×2 tiles.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/data/mapConfig.ts
git commit -m "feat: add interactive furniture and room to frontend types/config"
```

---

### Task 6: Frontend — Update uiStore

**Files:**
- Modify: `frontend/src/stores/uiStore.ts`

- [ ] **Step 1: Update uiStore — replace `archiveDrawerOpen` with `roomArchiveOpen`, update `openNewTaskModal`**

Replace the entire `frontend/src/stores/uiStore.ts`:

```typescript
import { create } from 'zustand';

interface DocViewerTarget {
  sessionId: string;
  filename: string;
}

interface UiState {
  newTaskModalOpen: boolean;
  newTaskRoom: string | null;
  agentDetailPanel: string | null;
  docViewer: DocViewerTarget | null;
  roomArchiveOpen: string | null;

  openNewTaskModal: (roomId: string) => void;
  closeNewTaskModal: () => void;
  openAgentDetail: (agentId: string) => void;
  closeAgentDetail: () => void;
  openDocViewer: (target: DocViewerTarget) => void;
  closeDocViewer: () => void;
  openRoomArchive: (roomId: string) => void;
  closeRoomArchive: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  newTaskModalOpen: false,
  newTaskRoom: null,
  agentDetailPanel: null,
  docViewer: null,
  roomArchiveOpen: null,

  openNewTaskModal: (roomId) => set({ newTaskModalOpen: true, newTaskRoom: roomId }),
  closeNewTaskModal: () => set({ newTaskModalOpen: false, newTaskRoom: null }),
  openAgentDetail: (agentId) => set({ agentDetailPanel: agentId }),
  closeAgentDetail: () => set({ agentDetailPanel: null }),
  openDocViewer: (target) => set({ docViewer: target }),
  closeDocViewer: () => set({ docViewer: null }),
  openRoomArchive: (roomId) => set({ roomArchiveOpen: roomId }),
  closeRoomArchive: () => set({ roomArchiveOpen: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/stores/uiStore.ts
git commit -m "feat: update uiStore with room-aware archive and task modal"
```

---

### Task 7: Frontend — Update sessionStore

**Files:**
- Modify: `frontend/src/stores/sessionStore.ts`

- [ ] **Step 1: Update `createSession` to accept and pass `room`**

In `frontend/src/stores/sessionStore.ts`, change the `createSession` signature and implementation:

```typescript
createSession: async (requirement, mode, room) => {
  const session = await api.createSession({ requirement, mode, room });
  set((state) => ({
    sessions: [session, ...state.sessions],
    activeSession: session,
  }));
},
```

Update the interface at the top:

```typescript
createSession: (requirement: string, mode: 'default' | 'brainstorm', room: string) => Promise<void>;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/stores/sessionStore.ts
git commit -m "feat: add room param to sessionStore.createSession"
```

---

### Task 8: Frontend — Update NewTaskModal

**Files:**
- Modify: `frontend/src/components/overlay/NewTaskModal.tsx`

- [ ] **Step 1: Rewrite NewTaskModal to use room from uiStore**

Replace the entire `frontend/src/components/overlay/NewTaskModal.tsx`:

```typescript
import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import { ROOMS } from '../../data/mapConfig';
import type { SessionMode } from '../../types';

export function NewTaskModal() {
  const open = useUiStore((s) => s.newTaskModalOpen);
  const roomId = useUiStore((s) => s.newTaskRoom);
  const close = useUiStore((s) => s.closeNewTaskModal);
  const createSession = useSessionStore((s) => s.createSession);

  const [requirement, setRequirement] = useState('');
  const [mode, setMode] = useState<SessionMode>('default');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomName = roomId ? ROOMS.find((r) => r.id === roomId)?.name : '';

  const handleSubmit = async () => {
    if (!requirement.trim() || !roomId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSession(requirement.trim(), mode, roomId);
      setRequirement('');
      setMode('default');
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={`提交新需求${roomName ? ` — ${roomName}` : ''}`}>
      <textarea
        className="w-full bg-gray-900 text-white rounded-lg p-3 border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
        rows={4}
        placeholder="描述你的需求..."
        value={requirement}
        onChange={(e) => setRequirement(e.target.value)}
      />
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      <div className="flex items-center gap-3 mt-4">
        <select
          className="bg-gray-900 text-white rounded-lg px-3 py-2 border border-gray-600"
          value={mode}
          onChange={(e) => setMode(e.target.value as SessionMode)}
        >
          <option value="default">默认模式（四角色流程）</option>
          <option value="brainstorm">头脑风暴</option>
        </select>
        <button
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg disabled:opacity-50"
          disabled={submitting || !requirement.trim()}
          onClick={handleSubmit}
        >
          {submitting ? '启动中...' : '启动'}
        </button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/overlay/NewTaskModal.tsx
git commit -m "feat: NewTaskModal uses room from uiStore, shows room name and errors"
```

---

### Task 9: Frontend — Update ArchiveDrawer

**Files:**
- Modify: `frontend/src/components/overlay/ArchiveDrawer.tsx`

- [ ] **Step 1: Rewrite ArchiveDrawer to filter by room agents**

Replace the entire `frontend/src/components/overlay/ArchiveDrawer.tsx`:

```typescript
import { useState } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSessionList } from '../../hooks/useSession';
import { ROOMS } from '../../data/mapConfig';
import { Modal } from '../ui/Modal';

export function ArchiveDrawer() {
  const roomId = useUiStore((s) => s.roomArchiveOpen);
  const close = useUiStore((s) => s.closeRoomArchive);
  const openDoc = useUiStore((s) => s.openDocViewer);
  const { sessions } = useSessionList();
  const setActive = useSessionStore((s) => s.setActiveSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmTarget = confirmId ? sessions.find((s) => s.id === confirmId) : null;

  const roomAgents = roomId ? ROOMS.find((r) => r.id === roomId)?.agents ?? [] : [];
  const roomName = roomId ? ROOMS.find((r) => r.id === roomId)?.name ?? '' : '';

  // Filter sessions: only show sessions whose phases include at least one of this room's agents
  const filteredSessions = sessions.filter((session) =>
    session.phases.some((p) => p.agents.some((a) => roomAgents.includes(a)))
  );

  const handleDelete = async () => {
    if (!confirmId) return;
    setDeleting(true);
    try {
      await deleteSession(confirmId);
      setConfirmId(null);
    } catch {
      // Error shown via UI state
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (status: string) =>
    status === 'completed' || status === 'failed' || status === 'cancelled';

  const uniqueOutputs = (outputs: string[]) => [...new Set(outputs)];

  if (!roomId) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={close} />
        <div className="relative w-96 bg-gray-800 border-l border-gray-700 h-full overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-semibold">档案柜 — {roomName}</h3>
              <button className="text-gray-400 hover:text-white" onClick={close}>✕</button>
            </div>

            {filteredSessions.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无文档</p>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-gray-900 rounded-lg p-3 border border-gray-700 cursor-pointer hover:border-gray-500"
                    onClick={() => setActive(session)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm font-mono">{session.id}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          session.status === 'completed' ? 'bg-green-900 text-green-400' :
                          session.status === 'running' ? 'bg-blue-900 text-blue-400' :
                          session.status === 'failed' ? 'bg-red-900 text-red-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {session.status}
                        </span>
                        {canDelete(session.status) && (
                          <button
                            className="text-gray-500 hover:text-red-400 text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmId(session.id);
                            }}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      {(session.input_requirement ?? '').length > 60
                        ? `${session.input_requirement.slice(0, 60)}...`
                        : (session.input_requirement ?? '')}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {uniqueOutputs(session.phases.flatMap((p) => p.outputs)).map((f) => (
                        <button
                          key={f}
                          className="text-xs text-blue-400 hover:text-blue-300 bg-gray-800 px-2 py-0.5 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDoc({ sessionId: session.id, filename: f });
                          }}
                        >
                          📄 {f}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={confirmId !== null}
        onClose={() => !deleting && setConfirmId(null)}
        title="删除档案"
      >
        <p className="text-gray-300 text-sm mb-4">
          确定要删除档案「{confirmTarget
            ? (confirmTarget.input_requirement.length > 30
              ? `${confirmTarget.input_requirement.slice(0, 30)}...`
              : confirmTarget.input_requirement)
            : ''}」吗？此操作不可恢复。
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-700 rounded-lg"
            onClick={() => setConfirmId(null)}
            disabled={deleting}
          >
            取消
          </button>
          <button
            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg disabled:opacity-50"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? '删除中...' : '删除'}
          </button>
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/overlay/ArchiveDrawer.tsx
git commit -m "feat: ArchiveDrawer filters by room agents, replaces global drawer"
```

---

### Task 10: Frontend — Update StatusBar (remove global buttons)

**Files:**
- Modify: `frontend/src/components/overlay/StatusBar.tsx`

- [ ] **Step 1: Remove global new-task and archive buttons**

Replace the entire `frontend/src/components/overlay/StatusBar.tsx`:

```typescript
import { useSessionStore } from '../../stores/sessionStore';

export function StatusBar() {
  const session = useSessionStore((s) => s.activeSession);

  const phaseLabels = session?.phases.map((p) => `${p.name}: ${p.status}`).join(' → ') ?? '';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-sm border-t border-gray-700 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-xs">
          {session ? (
            <>
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${session.status === 'running' ? 'bg-green-500' : session.status === 'completed' ? 'bg-blue-500' : session.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'}`} />
              Session: {session.id.slice(0, 14)}... | {session.status}
            </>
          ) : (
            '空闲'
          )}
        </span>
        {phaseLabels && <span className="text-gray-500 text-xs">{phaseLabels}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/overlay/StatusBar.tsx
git commit -m "feat: remove global new-task and archive buttons from StatusBar"
```

---

### Task 11: Frontend — Add interactive furniture rendering in OfficeMap

**Files:**
- Modify: `frontend/src/components/canvas/OfficeMap.tsx`

This is the largest task. We add `drawCabinet`, interactive hit areas for task/archive furniture, hover/click feedback, and task-in-progress guard.

- [ ] **Step 1: Add `drawCabinet` function**

In `frontend/src/components/canvas/OfficeMap.tsx`, add after `drawCovered` (after line 83):

```typescript
function drawCabinet(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth;
  const py = item.y * tileHeight;
  const pw = item.width * tileWidth;
  const ph = item.height * tileHeight;

  // Cabinet body
  g.beginFill(item.color);
  g.drawRoundedRect(px + 1, py + 1, pw - 2, ph - 2, 2);
  g.endFill();

  // Drawer lines
  const drawerCount = 3;
  const drawerH = (ph - 4) / drawerCount;
  for (let i = 0; i < drawerCount; i++) {
    const dy = py + 2 + i * drawerH;
    g.lineStyle(1, 0x6b5b47, 0.5);
    g.moveTo(px + 3, dy + drawerH - 1);
    g.lineTo(px + pw - 3, dy + drawerH - 1);

    // Handle (small rectangle centered)
    g.beginFill(0xccaa88, 0.6);
    g.drawRoundedRect(px + pw / 2 - 3, dy + drawerH / 2 - 1, 6, 2, 1);
    g.endFill();
  }
  g.lineStyle(0);
}
```

- [ ] **Step 2: Add `drawCabinet` to `drawFurniture` switch**

In `drawFurniture`, add case:

```typescript
case 'cabinet':
  drawCabinet(g, item);
  break;
```

- [ ] **Step 3: Add interactive hit areas after furniture rendering**

In the `OfficeMap` component's `useEffect`, after the room rendering loop (after line 208, before `viewport.addChild(container)`), add interactive furniture handling. This requires importing `useUiStore` and `useSessionStore`:

Add imports at top:
```typescript
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import { Container } from 'pixi.js';
```

Inside the component, add store hooks:
```typescript
export function OfficeMap() {
  const viewport = useViewport();
  const openNewTask = useUiStore((s) => s.openNewTaskModal);
  const openArchive = useUiStore((s) => s.openRoomArchive);
  const activeSession = useSessionStore((s) => s.activeSession);
```

After the room loop and before `viewport.addChild(container)`, add:

```typescript
    // 5. Interactive furniture hit areas (active rooms only)
    for (const room of ROOMS) {
      if (room.status !== 'active') continue;

      for (const item of room.furniture) {
        if (!item.interactive) continue;

        const hitArea = new Container();
        hitArea.eventMode = 'static';
        hitArea.cursor = 'pointer';

        if (item.interactive === 'task') {
          // Round table: use ellipse hit area
          const cx = (item.x + item.width / 2) * tileWidth;
          const cy = (item.y + item.height / 2) * tileHeight;
          const rx = (item.width * tileWidth) / 2;
          const ry = (item.height * tileHeight) / 2;

          const hit = new Graphics();
          hit.beginFill(0xffffff, 0);
          hit.drawEllipse(cx, cy, rx, ry);
          hit.endFill();
          hitArea.addChild(hit);

          // Hover glow
          const glow = new Graphics();
          glow.beginFill(0xffff00, 0.15);
          glow.drawEllipse(cx, cy, rx, ry);
          glow.endFill();
          glow.alpha = 0;
          hitArea.addChild(glow);

          hitArea.on('pointerover', () => { glow.alpha = 1; });
          hitArea.on('pointerout', () => { glow.alpha = 0; });

          hitArea.on('pointerdown', () => {
            // Task-in-progress guard
            if (activeSession && activeSession.status === 'running') {
              return;
            }
            openNewTask(room.id);
          });
        } else if (item.interactive === 'archive') {
          // Cabinet: use rect hit area
          const px = item.x * tileWidth;
          const py = item.y * tileHeight;
          const pw = item.width * tileWidth;
          const ph = item.height * tileHeight;

          const hit = new Graphics();
          hit.beginFill(0xffffff, 0);
          hit.drawRect(px, py, pw, ph);
          hit.endFill();
          hitArea.addChild(hit);

          // Hover highlight
          const highlight = new Graphics();
          highlight.beginFill(0xffffff, 0.15);
          highlight.drawRoundedRect(px + 1, py + 1, pw - 2, ph - 2, 2);
          highlight.endFill();
          highlight.alpha = 0;
          hitArea.addChild(highlight);

          hitArea.on('pointerover', () => { highlight.alpha = 1; });
          hitArea.on('pointerout', () => { highlight.alpha = 0; });

          hitArea.on('pointerdown', () => {
            openArchive(room.id);
          });
        }

        container.addChild(hitArea);
      }
    }
```

- [ ] **Step 4: Update the useEffect dependency array**

Change the dependency array to include the store values:

```typescript
  }, [viewport, openNewTask, openArchive, activeSession]);
```

- [ ] **Step 5: Run frontend build to verify no type errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/canvas/OfficeMap.tsx
git commit -m "feat: add interactive cabinet and round table with hover/click in OfficeMap"
```

---

### Task 12: Integration verification

**Files:** No new files

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && uv run pytest -v`
Expected: ALL PASS

- [ ] **Step 2: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Start backend and frontend, test manually**

1. Start backend: `cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser at http://localhost:3000
4. Verify: R&D room shows cabinet in top-left corner
5. Click the round table → NewTaskModal opens with "提交新需求 — 研发部"
6. Click the cabinet → ArchiveDrawer opens with "档案柜 — 研发部"
7. Status bar has no "+ 新任务" or "档案柜" buttons

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for room interaction feature"
```
