# Room Interaction Design — Filing Cabinet & Desk Task Submission

Date: 2026-04-18

## Summary

Add interactive elements to active rooms: a filing cabinet per room (top-left corner) for viewing room-filtered documents, and a clickable round table for submitting tasks limited to that room's agents. Remove the global archive drawer and global new-task button from the status bar.

## Requirements

- Only active rooms get interactive furniture
- Filing cabinet shows documents filtered by the room's agents
- Clicking the round table opens a task submission modal scoped to the room's agents
- `room` is a required parameter for session creation (backend enforces)
- Global archive button and global new-task button are removed from status bar

## Data Model Changes

### `mapConfig.ts` — FurnitureItem extension

```typescript
interface FurnitureItem {
  type: 'desk' | 'chair' | 'whiteboard' | 'screen' | 'bookshelf' | 'cabinet' | 'lamp' | 'round_table' | 'covered';
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  interactive?: 'task' | 'archive';  // NEW: click behavior
}
```

R&D room furniture changes:
- Round table: add `interactive: 'task'`
- Add cabinet: `{ type: 'cabinet', x: 7, y: 0, width: 2, height: 2, color: 0x8B7355, interactive: 'archive' }`

### `uiStore.ts` — State changes

Remove `archiveDrawerOpen`. Add:
```typescript
roomArchiveOpen: string | null,  // roomId
```

Actions: `openRoomArchive(roomId)`, `closeRoomArchive()`.

### Agent YAML — Add `room` field

Each agent YAML in `vault/agents/` gets a required `room` field:
```yaml
id: analyst
model: claude-sonnet-4-20250514
room: rd
system_prompt: ...
```

## Backend Changes

### `POST /api/sessions`

- `room` is a **required** field in the request body
- Missing or invalid room returns `422` with error message
- Backend filters agent definitions from `vault/agents/*.yaml` by matching `room` field
- Only matched agents are assigned to the session

### Agent filtering

New method on `WorkflowEngine` or `AgentPool`: `get_agents_by_room(room_id)`:
1. Scan `vault/agents/*.yaml`
2. Parse each YAML, collect `room` field
3. Return matching agent definitions

No backward compatibility — room is always required.

## Frontend Interaction Flow

### Click round table → submit task

1. `OfficeMap.tsx` detects `interactive === 'task'` furniture, sets `eventMode = 'static'`, binds `pointerdown`
2. Click calls `uiStore.openNewTaskModal(roomId)`
3. `NewTaskModal` receives `roomId` prop, displays room name as context, submits with `room` field
4. Status bar "+ 新任务" button removed

### Click filing cabinet → side drawer

1. `OfficeMap.tsx` detects `interactive === 'archive'` furniture, sets `eventMode = 'static'`, binds `pointerdown`
2. Click calls `uiStore.openRoomArchive(roomId)`
3. `ArchiveDrawer` receives `roomId` prop, filters documents by `mapConfig` room agents
4. Status bar "档案柜" button removed

### Task-in-progress guard

- When a session is already running for the room, clicking the table shows a toast/modal: "该房间正在执行任务"
- Check via `sessionStore.activeSession` status

## Rendering Details

### Cabinet (`drawCabinet` in OfficeMap.tsx)

- Pixel size: ~64×64 (2×2 tiles), top-left corner of room
- Brown rectangle body with 3 horizontal drawer lines and small handles
- No documents: dimmed appearance
- Has documents: normal color + small file icon badge
- Hover: light highlight border (alpha 0.3 white overlay)
- Click: brief scale animation (1→0.95→1, 150ms)

### Round table interaction layer

- Existing `drawRoundTable` rendering unchanged
- `eventMode = 'static'`, `cursor = 'pointer'`
- Hover: faint yellow glow circle (alpha 0.2)
- Click: brief flash (alpha 0→0.4→0, 200ms)

### Renovating rooms

- No interactive events bound on furniture in rooms with `status !== 'active'`

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Room has running session | Toast/modal: "该房间正在执行任务" |
| Empty archive | Drawer shows "暂无文档" with dimmed cabinet |
| Session creation fails | NewTaskModal shows error, stays open for retry |
| Invalid/missing room param | Backend returns 422 |
