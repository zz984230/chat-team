# 角色精灵升级与缩放修复 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace circle-based agent sprites with atlas spritesheet character sprites (with walk animations), remove name labels, and fix mouse-centered zoom.

**Architecture:** Load existing `atlas.json`/`atlas.png` TexturePacker spritesheet in Phaser, define 8 directional animations (idle + walk x 4 directions), replace `Arc` body with `Sprite`, apply per-agent tint coloring, fix wheel zoom by temporarily removing camera bounds during scroll correction.

**Tech Stack:** Phaser 3.87, TypeScript, React 18

---

## File Structure

| File | Responsibility |
|------|---------------|
| `frontend/src/game/types.ts` | AgentVisual interface — body type change, field removal |
| `frontend/src/game/AgentSpriteFactory.ts` | Sprite creation, animation definition/playback, position sync |
| `frontend/src/game/OfficeScene.ts` | Resource loading, agent placement, camera zoom fix |
| `frontend/src/game/RandomWalker.ts` | No changes (benefits indirectly via syncPosition) |

### Task 1: Update AgentVisual Interface

**Files:**
- Modify: `frontend/src/game/types.ts:1-18`

This task updates the interface to use `Sprite` instead of `Arc` and removes the unused fields.

- [ ] **Step 1: Update the AgentVisual interface in `frontend/src/game/types.ts`**

Replace the entire `AgentVisual` interface (lines 8-18) with:

```typescript
export interface AgentVisual {
  agentId: string;
  body: Phaser.GameObjects.Sprite;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleText: Phaser.GameObjects.Text;
  bubbleBg: Phaser.GameObjects.Graphics;
  direction: AgentDirection;
  animState: AgentAnimationState;
}
```

The key changes: `body: Phaser.GameObjects.Arc` → `Phaser.GameObjects.Sprite`, `dirDot` and `nameText` fields removed.

Also remove the `DIR_OFFSET` constant and the `AgentSeat`/`AGENT_SEATS`/`TILE_SIZE`/`MAP_WIDTH`/`MAP_HEIGHT`/`ROOM_INFO`/`LIB_COLLISIONS_RAW`/`isLibraryWalkable` — wait, those are still needed by `RandomWalker` and `OfficeScene`. Only the `AgentVisual` interface changes.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: Multiple errors in `AgentSpriteFactory.ts` and `OfficeScene.ts` referencing the removed `dirDot`/`nameText` fields and `Arc` type. This is expected — we fix them in subsequent tasks.

---

### Task 2: Rewrite AgentSpriteFactory.ts

**Files:**
- Modify: `frontend/src/game/AgentSpriteFactory.ts` (full rewrite)

This is the core task. The factory currently creates `Arc` circles; we rewrite it to create `Sprite` objects from the atlas spritesheet.

- [ ] **Step 1: Rewrite the entire `AgentSpriteFactory.ts`**

Replace the full contents of `frontend/src/game/AgentSpriteFactory.ts` with:

```typescript
import { TILE_SIZE, AGENT_SEATS, type AgentVisual } from './types';
import type { AgentDirection, AgentAnimationState } from '../types';

const BUBBLE_OFFSET_Y = -48;

const ANIM_PREFIX: Record<AgentAnimationState, string> = {
  idle: 'idle',
  walking: 'walk',
  working: 'idle',
  thinking: 'idle',
};

const DIR_KEY: Record<AgentDirection, string> = {
  down: 'front',
  up: 'back',
  left: 'left',
  right: 'right',
};

export function defineAnimations(scene: Phaser.Scene) {
  if (scene.anims.exists('idle-front')) return;

  const dirs = ['front', 'back', 'left', 'right'] as const;

  for (const dir of dirs) {
    // Idle animation — single frame, no repeat needed but use repeat -1 for consistency
    scene.anims.create({
      key: `idle-${dir}`,
      frames: [{ key: 'agents', frame: `misa-${dir}` }],
      frameRate: 8,
      repeat: -1,
    });

    // Walk animation — 4 frames
    scene.anims.create({
      key: `walk-${dir}`,
      frames: scene.anims.generateFrameNames('agents', {
        prefix: `misa-${dir}-walk.`,
        start: 0,
        end: 3,
        zeroPad: 3,
      }),
      frameRate: 8,
      repeat: -1,
    });
  }
}

export function createAgentVisual(
  scene: Phaser.Scene,
  agentId: string,
  onClick: (id: string) => void,
): AgentVisual {
  const seat = AGENT_SEATS[agentId]!;
  const px = seat.x * TILE_SIZE + TILE_SIZE / 2;
  const py = seat.y * TILE_SIZE + TILE_SIZE / 2;

  // Character sprite from atlas
  const body = scene.add.sprite(px, py, 'agents', 'misa-front');
  body.setOrigin(0.5, 1); // bottom-center so feet align with tile
  body.setTint(seat.tint);
  body.setDepth(py);
  body.setInteractive({ useHandCursor: true });
  body.on('pointerdown', () => onClick(agentId));

  // Thinking bubble
  const bubbleContainer = scene.add.container(px, py + BUBBLE_OFFSET_Y);
  bubbleContainer.setDepth(py + 1);
  bubbleContainer.setVisible(false);

  const bubbleBg = scene.add.graphics();
  const bubbleText = scene.add.text(0, 0, '', {
    fontSize: '9px',
    color: '#333333',
    wordWrap: { width: 80 },
    align: 'center',
  });
  bubbleText.setOrigin(0.5, 0.5);
  bubbleContainer.add([bubbleBg, bubbleText]);

  return {
    agentId,
    body,
    bubbleContainer,
    bubbleText,
    bubbleBg,
    direction: 'down',
    animState: 'idle',
  };
}

export function playAnimation(visual: AgentVisual, state: AgentAnimationState, direction: AgentDirection) {
  visual.animState = state;
  visual.direction = direction;
  const animKey = `${ANIM_PREFIX[state]}-${DIR_KEY[direction]}`;
  if (visual.body.anims?.currentAnim?.key !== animKey) {
    visual.body.play(animKey);
  }
}

export function updateBubble(visual: AgentVisual, content: string | null) {
  if (!content) {
    visual.bubbleContainer.setVisible(false);
    return;
  }
  visual.bubbleText.setText(content.length > 30 ? content.slice(0, 30) + '\u2026' : content);
  const tw = visual.bubbleText.width + 8;
  const th = visual.bubbleText.height + 6;
  visual.bubbleBg.clear();
  visual.bubbleBg.fillStyle(0xffffff, 0.9);
  visual.bubbleBg.fillRoundedRect(-tw / 2, -th / 2, tw, th, 4);
  visual.bubbleContainer.setVisible(true);
}

export function moveAgentTo(visual: AgentVisual, targetX: number, targetY: number, scene: Phaser.Scene) {
  const LIB_X = 118;
  const LIB_Y = 19;
  const px = (LIB_X + targetX) * TILE_SIZE + TILE_SIZE / 2;
  const py = (LIB_Y + targetY) * TILE_SIZE + TILE_SIZE / 2;

  scene.tweens.add({
    targets: visual.body,
    x: px,
    y: py,
    duration: 600,
    ease: 'Power1',
    onUpdate: () => {
      syncPosition(visual);
    },
  });
}

export function syncPosition(visual: AgentVisual) {
  const x = visual.body.x;
  const y = visual.body.y;
  visual.body.setDepth(y);
  visual.bubbleContainer.setPosition(x, y + BUBBLE_OFFSET_Y);
}
```

Key differences from original:
- `defineAnimations` now creates 8 real Phaser animations from atlas frames
- `createAgentVisual` creates a `Sprite` with atlas texture, tint, and bottom-center origin
- `playAnimation` maps `(state, direction)` to animation key and plays it on the Sprite
- `syncPosition` only syncs depth and bubble position (no dirDot/nameText)
- `BUBBLE_OFFSET_Y = -48` moves bubble above the sprite's head

- [ ] **Step 2: Verify no TypeScript errors in this file**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep AgentSpriteFactory`

Expected: No errors in AgentSpriteFactory.ts. Errors only remain in OfficeScene.ts referencing removed `dirDot`/`nameText`.

---

### Task 3: Update OfficeScene.ts

**Files:**
- Modify: `frontend/src/game/OfficeScene.ts`

This task updates the scene to: load the atlas, update agent placement (no more dirDot/nameText), and fix the zoom handler.

- [ ] **Step 1: Add atlas preload**

In `OfficeScene.ts`, add this line at the end of `preload()` (after line 48, the tilemapJSON load):

```typescript
    // Agent character spritesheet
    this.load.atlas('agents', 'assets/sprites/atlas.png', 'assets/sprites/atlas.json');
```

- [ ] **Step 2: Update agent placement in `create()`**

Replace the agent placement block (lines 104-119) with:

```typescript
    // Place agents at their seats within the library room (map pixel coords)
    for (const agentId of Object.keys(AGENT_SEATS)) {
      const visual = createAgentVisual(this, agentId, (id) => {
        this.callbacks?.onAgentClick(id);
      });
      const seat = AGENT_SEATS[agentId]!;
      const px = (LIB_X + seat.x) * TILE_SIZE + TILE_SIZE / 2;
      const py = (LIB_Y + seat.y) * TILE_SIZE + TILE_SIZE / 2;
      visual.body.setPosition(px, py);
      visual.body.setDepth(py);
      visual.bubbleContainer.setPosition(px, py - 48);
      this.agents.set(agentId, visual);
    }
```

The key change: no `dirDot.setPosition`, no `nameText.setPosition`, no `bubbleContainer` depth needs separate setting (createAgentVisual already sets it).

- [ ] **Step 3: Fix the wheel handler for mouse-centered zoom**

Replace the wheel handler (lines 169-178) with:

```typescript
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any[], _dx: number, dy: number) => {
      const zoomFactor = dy > 0 ? 0.9 : 1.1;
      const newZoom = Phaser.Math.Clamp(cam.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);

      // Temporarily remove bounds so scroll correction isn't clamped
      cam.setBounds(0, 0, mapPixelW * 10, mapPixelH * 10);

      const worldBefore = cam.getWorldPoint(_pointer.x, _pointer.y);
      cam.setZoom(newZoom);
      const worldAfter = cam.getWorldPoint(_pointer.x, _pointer.y);
      cam.scrollX += worldBefore.x - worldAfter.x;
      cam.scrollY += worldBefore.y - worldAfter.y;

      // Restore bounds — Phaser clamps scroll to valid range
      cam.setBounds(0, 0, mapPixelW, mapPixelH);
    });
```

- [ ] **Step 4: Fix the resize handler**

Replace the resize handler (lines 180-184) with:

```typescript
    this.scale.on('resize', () => {
      const newFitZoom = Math.min(this.scale.width / mapPixelW, this.scale.height / mapPixelH);
      if (cam.zoom < newFitZoom) {
        cam.setZoom(newFitZoom);
        cam.centerOn(mapPixelW / 2, mapPixelH / 2);
      }
    });
```

This only resets zoom if the current zoom is less than the new minimum (e.g., window grew larger). It preserves user zoom level otherwise.

- [ ] **Step 5: Verify TypeScript compiles cleanly**

Run: `cd frontend && npx tsc --noEmit 2>&1`

Expected: No errors. All files should compile cleanly.

---

### Task 4: Visual Verification

**Files:** None (manual testing)

- [ ] **Step 1: Start the frontend dev server**

Run: `cd frontend && npm run dev`

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000` and check:
1. **Sprites visible**: Four colored character sprites (green, blue, orange, purple) standing in the library room — not circles
2. **No name labels**: No text below characters
3. **Walk animations**: Characters idle-wander with directional walk animations (front/back/left/right frames cycling)
4. **Mouse-centered zoom**: Scroll wheel zooms centered on cursor position, not viewport center
5. **Click interaction**: Clicking a character opens the agent detail panel
6. **Thinking bubble**: Bubble still appears above character heads when thinking

- [ ] **Step 3: Commit all changes**

```bash
git add frontend/src/game/types.ts frontend/src/game/AgentSpriteFactory.ts frontend/src/game/OfficeScene.ts
git commit -m "feat: upgrade agent sprites to atlas characters with walk animations, remove name labels, fix mouse-centered zoom"
```
