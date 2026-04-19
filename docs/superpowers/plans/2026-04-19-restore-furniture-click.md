# Restore Furniture Click Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore clickable table and cabinet zones in the Phaser 3 library room that open task submission and archive UI respectively.

**Architecture:** Add two invisible Phaser Zone objects in the library room — one over the center tables (task) and one over the top-wall cabinets (archive). Modify the existing drag handler to distinguish clicks (< 5px movement) from drags, so zone clicks fire through the existing `onRoomClick` callback.

**Tech Stack:** Phaser 3.87, TypeScript, React 18, Zustand

---

## File Structure

| File | Change |
|------|--------|
| `frontend/src/game/OfficeScene.ts` | Add furniture zones, modify drag/click discrimination |
| `frontend/src/components/canvas/PhaserGame.tsx` | Implement `onRoomClick` callback |

---

### Task 1: Add furniture click zones and fix click/drag discrimination

**Files:**
- Modify: `frontend/src/game/OfficeScene.ts`

- [ ] **Step 1: Add zones for table and cabinet**

After the walker initialization block (line 123) and before the camera setup (line 125), add the furniture zones:

```typescript
    // Interactive furniture zones
    // Table: center of room, cols 2-3 rows 3-5
    const tableZone = this.add.zone(
      (LIB_X + 2.5) * TILE_SIZE,   // center between cols 2-3
      (LIB_Y + 4) * TILE_SIZE,     // center between rows 3-5
      2 * TILE_SIZE,               // 2 tiles wide
      3 * TILE_SIZE,               // 3 tiles tall
    );
    tableZone.setInteractive({ useHandCursor: true });
    tableZone.setDepth((LIB_Y + 5) * TILE_SIZE);  // depth above table tiles

    // Cabinet: top wall, cols 1-3 row 0
    const cabinetZone = this.add.zone(
      (LIB_X + 2) * TILE_SIZE,     // center between cols 1-3
      (LIB_Y + 0.5) * TILE_SIZE,   // center of row 0
      3 * TILE_SIZE,               // 3 tiles wide
      1 * TILE_SIZE,               // 1 tile tall
    );
    cabinetZone.setInteractive({ useHandCursor: true });
    cabinetZone.setDepth((LIB_Y + 0) * TILE_SIZE);
```

- [ ] **Step 2: Modify drag handler to track pointer start and detect clicks**

Replace the pointerdown/pointermove/pointerup handlers (lines 147-166) with click-aware versions. The key change: record the start position, and on pointerup check if it was a click (< 5px movement). Zone clicks are handled by Phaser's interactive system automatically — they will fire regardless, but the `onRoomClick` callback only fires if it wasn't a drag.

Replace lines 147-166 with:

```typescript
    let dragStartX = 0;
    let dragStartY = 0;
    let camStartX = 0;
    let camStartY = 0;
    let dragging = false;
    let pointerMoved = false;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      dragging = true;
      pointerMoved = false;
      dragStartX = pointer.x;
      dragStartY = pointer.y;
      camStartX = cam.scrollX;
      camStartY = cam.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dx = pointer.x - dragStartX;
      const dy = pointer.y - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        pointerMoved = true;
      }
      if (pointerMoved) {
        cam.scrollX = camStartX - dx / cam.zoom;
        cam.scrollY = camStartY - dy / cam.zoom;
      }
    });

    this.input.on('pointerup', () => {
      dragging = false;
    });
```

- [ ] **Step 3: Wire zone clicks to onRoomClick**

After the zone creation code from Step 1, add click handlers that only fire when it wasn't a drag:

```typescript
    tableZone.on('pointerdown', () => {
      if (!pointerMoved) {
        this.callbacks?.onRoomClick('task');
      }
    });

    cabinetZone.on('pointerdown', () => {
      if (!pointerMoved) {
        this.callbacks?.onRoomClick('archive');
      }
    });
```

Note: Using `pointerdown` on the zone. The zone's pointerdown fires before the global pointerup, but `pointerMoved` is set in `pointermove` which fires before pointerdown on the zone. Actually, the correct approach is to use `pointerup` on the zone instead:

```typescript
    tableZone.on('pointerup', () => {
      if (!pointerMoved) {
        this.callbacks?.onRoomClick('task');
      }
    });

    cabinetZone.on('pointerup', () => {
      if (!pointerMoved) {
        this.callbacks?.onRoomClick('archive');
      }
    });
```

Using `pointerup` ensures `pointerMoved` has its final value.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1`

Expected: No errors.

---

### Task 2: Implement onRoomClick callback

**Files:**
- Modify: `frontend/src/components/canvas/PhaserGame.tsx`

- [ ] **Step 1: Replace empty onRoomClick with real implementation**

In `PhaserGame.tsx`, replace the empty `onRoomClick` callback (line 41):

```typescript
      onRoomClick: (_zone: string) => {},
```

With:

```typescript
      onRoomClick: (zone: string) => {
        if (zone === 'archive') {
          useUiStore.getState().openRoomArchive('rd');
        } else if (zone === 'task') {
          useUiStore.getState().openNewTaskModal('rd');
        }
      },
```

Ensure `useUiStore` is imported at the top of the file (it already is — line 6).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1`

Expected: No errors.

---

### Task 3: Visual verification and commit

- [ ] **Step 1: Start dev server and verify**

Run: `cd frontend && npm run dev`

Check in browser:
1. Zoom into the library room
2. Click on the center tables → NewTaskModal should open
3. Click on the top wall area → ArchiveDrawer should open
4. Drag to pan → no click events should fire

- [ ] **Step 2: Commit**

```bash
git add frontend/src/game/OfficeScene.ts frontend/src/components/canvas/PhaserGame.tsx
git commit -m "feat: restore table and cabinet click interactions in Phaser scene"
```
