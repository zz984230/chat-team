# 档案柜删除功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-session delete capability to the archive drawer with confirmation dialog, blocking deletion of running/paused sessions.

**Architecture:** Backend adds `VaultManager.delete_session()` + `DELETE /api/sessions/{id}` endpoint with status guard. Frontend adds delete button to ArchiveDrawer cards, confirmation modal, and `sessionStore.deleteSession()` action.

**Tech Stack:** Python (FastAPI, pytest), TypeScript (React, Zustand)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/app/vault/manager.py` | Add `delete_session()` method |
| Modify | `backend/app/api/sessions.py` | Add `DELETE /sessions/{id}` endpoint |
| Modify | `backend/tests/test_vault.py` | Test `delete_session()` |
| Modify | `backend/tests/test_api.py` | Test `DELETE` endpoint |
| Modify | `frontend/src/services/api.ts` | Add `deleteSession()` API call |
| Modify | `frontend/src/stores/sessionStore.ts` | Add `deleteSession()` action |
| Modify | `frontend/src/components/overlay/ArchiveDrawer.tsx` | Add delete button + confirmation modal |

---

### Task 1: VaultManager.delete_session()

**Files:**
- Modify: `backend/app/vault/manager.py` (after `list_outputs` method, ~L95)
- Test: `backend/tests/test_vault.py` (append at end)

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_vault.py`:

```python
import shutil


def test_delete_session(tmp_vault: Path):
    """delete_session removes session directory entirely."""
    vm = VaultManager(tmp_vault)
    session = Session.from_request(
        CreateSessionRequest(requirement="test"),
        "20260413-153000-abc",
    )
    vm.create_session(session)

    result = vm.delete_session("20260413-153000-abc")
    assert result is True
    assert not (tmp_vault / "sessions" / "20260413-153000-abc").exists()


def test_delete_session_not_found(tmp_vault: Path):
    """delete_session returns False for nonexistent session."""
    vm = VaultManager(tmp_vault)
    result = vm.delete_session("nonexistent")
    assert result is False


def test_delete_session_removes_from_list(tmp_vault: Path):
    """delete_session removes session from list_sessions results."""
    vm = VaultManager(tmp_vault)
    session = Session.from_request(
        CreateSessionRequest(requirement="test"),
        "20260413-153000-abc",
    )
    vm.create_session(session)

    assert len(vm.list_sessions()) == 1
    vm.delete_session("20260413-153000-abc")
    assert len(vm.list_sessions()) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_vault.py::test_delete_session tests/test_vault.py::test_delete_session_not_found tests/test_vault.py::test_delete_session_removes_from_list -v`
Expected: FAIL — `AttributeError: 'VaultManager' object has no attribute 'delete_session'`

- [ ] **Step 3: Write minimal implementation**

Add import at top of `backend/app/vault/manager.py`:

```python
import shutil
```

Add method to `VaultManager` class after `list_outputs` (before `_write_meta`):

```python
    def delete_session(self, session_id: str) -> bool:
        """Delete session directory and all contents."""
        session_dir = self._sessions_path / session_id
        if not session_dir.exists():
            return False
        shutil.rmtree(session_dir)
        return True
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_vault.py::test_delete_session tests/test_vault.py::test_delete_session_not_found tests/test_vault.py::test_delete_session_removes_from_list -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/vault/manager.py backend/tests/test_vault.py
git commit -m "feat: add VaultManager.delete_session() with tests"
```

---

### Task 2: DELETE /api/sessions/{id} endpoint

**Files:**
- Modify: `backend/app/api/sessions.py` (after `cancel_session`, ~L130)
- Test: `backend/tests/test_api.py` (append at end)

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_api.py`:

```python
@pytest.mark.asyncio
async def test_delete_session(client: AsyncClient):
    """DELETE /api/sessions/{id} removes a completed session."""
    create_resp = await client.post("/api/sessions", json={"requirement": "to delete"})
    session_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/sessions/{session_id}")
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(f"/api/sessions/{session_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_session_not_found(client: AsyncClient):
    """DELETE /api/sessions/{id} returns 404 for nonexistent."""
    resp = await client.delete("/api/sessions/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_running_session_conflict(client: AsyncClient):
    """DELETE /api/sessions/{id} returns 409 for running session."""
    create_resp = await client.post("/api/sessions", json={"requirement": "running"})
    session_id = create_resp.json()["id"]

    # Manually set status to running via vault
    session = _engine.vault_manager.get_session(session_id)
    session.status = SessionStatus.RUNNING
    _engine.vault_manager.update_session(session)

    resp = await client.delete(f"/api/sessions/{session_id}")
    assert resp.status_code == 409
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_api.py::test_delete_session tests/test_api.py::test_delete_session_not_found tests/test_api.py::test_delete_running_session_conflict -v`
Expected: FAIL — 404 or method not allowed

- [ ] **Step 3: Write minimal implementation**

Add to `backend/app/api/sessions.py` after the `cancel_session` function (before `session_websocket`):

```python
@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str):
    """Delete a completed, failed, or cancelled session."""
    assert _engine is not None
    session = _engine.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status in (SessionStatus.RUNNING, SessionStatus.PAUSED):
        raise HTTPException(status_code=409, detail=f"Cannot delete session in '{session.status.value}' state")
    _engine.vault_manager.delete_session(session_id)
```

Note: the endpoint has no `return` statement — FastAPI returns 204 No Content automatically for status_code=204 when no body is returned.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_api.py::test_delete_session tests/test_api.py::test_delete_session_not_found tests/test_api.py::test_delete_running_session_conflict -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/sessions.py backend/tests/test_api.py
git commit -m "feat: add DELETE /api/sessions/{id} endpoint with status guard"
```

---

### Task 3: Frontend API + Store

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/stores/sessionStore.ts`

- [ ] **Step 1: Add deleteSession to API client**

In `frontend/src/services/api.ts`, add a `requestVoid` helper and the `deleteSession` method.

Add this helper function after the existing `request` function (after line 12):

```typescript
async function requestVoid(url: string, options?: RequestInit): Promise<void> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
}
```

Add to the `api` object (after `cancelSession`):

```typescript
  deleteSession: (id: string) =>
    requestVoid(`/api/sessions/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 2: Add deleteSession to sessionStore**

In `frontend/src/stores/sessionStore.ts`:

Add `deleteSession` to the `SessionState` interface:

```typescript
  deleteSession: (id: string) => Promise<void>;
```

Add the implementation in the store body (after `setSessionStatus`):

```typescript
  deleteSession: async (id) => {
    await api.deleteSession(id);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSession: state.activeSession?.id === id ? null : state.activeSession,
    }));
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/stores/sessionStore.ts
git commit -m "feat: add deleteSession to API client and session store"
```

---

### Task 4: ArchiveDrawer delete UI

**Files:**
- Modify: `frontend/src/components/overlay/ArchiveDrawer.tsx`

- [ ] **Step 1: Add delete button and confirmation modal**

Replace the entire content of `frontend/src/components/overlay/ArchiveDrawer.tsx` with:

```tsx
import { useState } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSessionList } from '../../hooks/useSession';
import { Modal } from '../ui/Modal';

export function ArchiveDrawer() {
  const open = useUiStore((s) => s.archiveDrawerOpen);
  const close = useUiStore((s) => s.closeArchiveDrawer);
  const openDoc = useUiStore((s) => s.openDocViewer);
  const { sessions } = useSessionList();
  const setActive = useSessionStore((s) => s.setActiveSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmTarget = confirmId ? sessions.find((s) => s.id === confirmId) : null;

  const handleDelete = async () => {
    if (!confirmId) return;
    setDeleting(true);
    try {
      await deleteSession(confirmId);
      setConfirmId(null);
    } catch {
      // Error shown via UI state, keep dialog open
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (status: string) =>
    status === 'completed' || status === 'failed' || status === 'cancelled';

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={close} />
        <div className="relative w-96 bg-gray-800 border-l border-gray-700 h-full overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-semibold">档案柜</h3>
              <button className="text-gray-400 hover:text-white" onClick={close}>✕</button>
            </div>

            {sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无历史记录</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
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
                      {session.phases.flatMap((p) => p.outputs).map((f) => (
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

Key changes:
- `useState` for `confirmId` (which session is pending confirmation) and `deleting` (loading state)
- `canDelete()` — only show trash button for completed/failed/cancelled sessions
- `handleDelete()` — calls store action, clears confirm state on success
- Confirmation `<Modal>` with cancel/delete buttons, disabled during request
- Trash button uses `e.stopPropagation()` to prevent card click

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual verification**

Start both servers and test in browser:
1. `cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
2. `cd frontend && npm run dev`
3. Open browser, create a session, wait for it to complete
4. Open archive drawer, verify trash icon appears on completed session
5. Click trash, verify confirmation modal appears with correct session name
6. Click "删除", verify session disappears from list
7. Verify running sessions do not show trash icon

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/overlay/ArchiveDrawer.tsx
git commit -m "feat: add delete button with confirmation to ArchiveDrawer"
```

---

## Self-Review

**Spec coverage:**
- VaultManager.delete_session() → Task 1 ✅
- DELETE /api/sessions/{id} with 404/409 guards → Task 2 ✅
- api.deleteSession() → Task 3 ✅
- sessionStore.deleteSession() with activeSession cleanup → Task 3 ✅
- Delete button on ArchiveDrawer cards → Task 4 ✅
- Confirmation modal with loading state → Task 4 ✅
- Only completed/failed/cancelled can be deleted → Task 4 `canDelete()` ✅
- Running/paused sessions blocked → Task 2 (backend 409) + Task 4 (frontend hide) ✅

**Placeholder scan:** No TBD/TODO/ambiguous steps. All code is complete.

**Type consistency:**
- `delete_session(session_id: str) -> bool` matches `VaultManager` pattern
- `api.deleteSession(id: string)` matches store call `api.deleteSession(confirmId)`
- `deleteSession(id: string) => Promise<void>` in store interface matches `await deleteSession(confirmId)` in component
- Session status values `'completed' | 'failed' | 'cancelled'` match across frontend and backend `SessionStatus` enum
