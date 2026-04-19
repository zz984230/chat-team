# Phaser 3 Office Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PixiJS canvas rendering with Phaser 3, using the Oak Hill College Library room extracted from generative_agents as the R&D office map.

**Architecture:** Phaser 3 Game instance embedded as a React component. Single `OfficeScene` handles tilemap rendering, agent sprites, and effects. React Overlay components (StatusBar, AgentDetailPanel, etc.) remain unchanged. Communication flows from Zustand stores into Phaser via component ref calls, and Phaser events flow back via callback props.

**Tech Stack:** Phaser 3, React 18, TypeScript, Zustand, Vite

---

## File Structure

### New files to create
```
frontend/src/components/canvas/PhaserGame.tsx        — React wrapper for Phaser Game
frontend/src/game/OfficeScene.ts                      — Main Phaser Scene
frontend/src/game/AgentSpriteFactory.ts               — Agent sprite + animation creation
frontend/src/game/types.ts                            — Shared Phaser game types
frontend/public/assets/maps/library.json              — Extracted library Tiled map
frontend/public/assets/sprites/atlas.png              — Character spritesheet
frontend/public/assets/sprites/atlas.json             — Spritesheet frame definitions
scripts/extract_library_map.py                        — One-time script to extract library from generative_agents map
```

### Files to modify
```
frontend/src/App.tsx                                  — Replace canvas components with PhaserGame
frontend/src/stores/agentStore.ts                     — Remove PixiJS refs, keep interface
frontend/package.json                                 — Swap pixi → phaser
```

### Files to delete
```
frontend/src/components/canvas/PixiCanvas.tsx
frontend/src/components/canvas/TiledMap.tsx
frontend/src/components/canvas/AgentSprite.tsx
frontend/src/components/canvas/CelebrationEffect.tsx
frontend/src/components/canvas/FlyingDocument.tsx
frontend/src/utils/tmxLoader.ts
frontend/src/data/mapConfig.ts
frontend/src/data/agentConfig.ts
frontend/src/data/spritesheets/
frontend/public/assets/maps/the_office.json
```

---

### Task 1: Extract Library Room Map

**Files:**
- Create: `scripts/extract_library_map.py`
- Create: `frontend/public/assets/maps/library.json`

This task generates a standalone Tiled JSON map file containing only the Oak Hill College Library room (tiles 118-124, 19-29) from the generative_agents map.

- [ ] **Step 1: Write the extraction script**

Create `scripts/extract_library_map.py` at project root:

```python
"""Extract the Oak Hill College Library room from generative_agents Tiled map.
Run from D:\\code\\chat-team root.
"""
import json
import os

SRC = r"D:\code\generative_agents\environment\frontend_server\static_dirs\assets\the_ville\visuals\the_ville_jan7.json"
DST = r"frontend\public\assets\maps\library.json"

# Library room bounds in the source map (inclusive)
X1, Y1, X2, Y2 = 118, 19, 124, 29
ROOM_W = X2 - X1 + 1  # 7
ROOM_H = Y2 - Y1 + 1  # 11

# Renderable layers only (exclude collision/arena/sector/spawn/meta layers)
RENDER_LAYERS = [
    "Bottom Ground", "Interior Ground", "Wall",
    "Interior Furniture L1", "Interior Furniture L2 ",
    "Foreground L1", "Foreground L2",
]


def extract():
    with open(SRC, "r") as f:
        src = json.load(f)

    src_w = src["width"]  # 140

    # Build tilesets list — only include tilesets that have tiles in the room area
    # We keep all tilesets since library uses Room_Builder and interiors
    tilesets = []
    for ts in src["tilesets"]:
        tilesets.append({
            "firstgid": ts["firstgid"],
            "image": ts["image"].replace("../../../../visuals/map_assets/v1/", "../tilesets/")
                              .replace("../../../../visuals/map_assets/blocks/", "../tilesets/"),
            "imageWidth": ts.get("imageWidth", ts.get("imagewidth", 0)),
            "imageHeight": ts.get("imageHeight", ts.get("imageheight", 0)),
            "tileWidth": ts.get("tileWidth", ts.get("tilewidth", 32)),
            "tileHeight": ts.get("tileHeight", ts.get("tileheight", 32)),
            "tileCount": ts.get("tileCount", ts.get("tilecount", 0)),
            "columns": ts.get("columns", 0),
            "name": ts["name"],
        })

    # Extract renderable layers
    layers = []
    for layer in src["layers"]:
        if layer["name"] not in RENDER_LAYERS:
            continue
        if "data" not in layer:
            continue

        src_data = layer["data"]
        # Extract the room region from the flat data array
        room_data = []
        for y in range(Y1, Y2 + 1):
            for x in range(X1, X2 + 1):
                idx = y * src_w + x
                room_data.append(src_data[idx])

        layers.append({
            "data": room_data,
            "height": ROOM_H,
            "width": ROOM_W,
            "name": layer["name"],
            "opacity": layer.get("opacity", 1),
            "type": "tilelayer",
            "visible": layer.get("visible", True),
            "x": 0,
            "y": 0,
        })

    out = {
        "compressionlevel": -1,
        "height": ROOM_H,
        "infinite": False,
        "layers": layers,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tileheight": 32,
        "tilewidth": 32,
        "tilesets": tilesets,
        "type": "map",
        "version": "1.10",
        "width": ROOM_W,
    }

    os.makedirs(os.path.dirname(DST), exist_ok=True)
    with open(DST, "w") as f:
        json.dump(out, f, indent=2)

    print(f"Extracted {ROOM_W}x{ROOM_H} library map to {DST}")
    print(f"Layers: {[l['name'] for l in layers]}")


if __name__ == "__main__":
    extract()
```

- [ ] **Step 2: Run the extraction script**

```bash
cd D:\code\chat-team
python scripts/extract_library_map.py
```

Expected output: `Extracted 7x11 library map to frontend\public\assets\maps\library.json`

- [ ] **Step 3: Verify the output**

```bash
python -c "import json; d=json.load(open('frontend/public/assets/maps/library.json')); print(f'Size: {d[\"width\"]}x{d[\"height\"]}'); print(f'Layers: {[l[\"name\"] for l in d[\"layers\"]]}'); print(f'Tilesets: {[t[\"name\"] for t in d[\"tilesets\"]]}')"
```

Expected: Size: 7x11, Layers include Wall, Interior Furniture L1, etc.

- [ ] **Step 4: Commit**

```bash
git add scripts/extract_library_map.py frontend/public/assets/maps/library.json
git commit -m "feat: extract Oak Hill College Library room from generative_agents map"
```

---

### Task 2: Copy and Prepare Sprite Assets

**Files:**
- Create: `frontend/public/assets/sprites/atlas.png`
- Create: `frontend/public/assets/sprites/atlas.json`

The generative_agents project loads atlas from an external URL. We localize it.

- [ ] **Step 1: Copy atlas.png from generative_agents**

```bash
cp "D:\code\generative_agents\environment\frontend_server\static_dirs\assets\img\atlas.png" "frontend\public\assets\sprites\atlas.png"
```

- [ ] **Step 2: Copy atlas.json from generative_agents**

```bash
cp "D:\code\generative_agents\environment\frontend_server\static_dirs\assets\characters\atlas.json" "frontend\public\assets\sprites\atlas.json"
```

- [ ] **Step 3: Verify atlas.json frame names**

```bash
python -c "import json; d=json.load(open('frontend/public/assets/sprites/atlas.json')); names=[f['filename'] for f in d['frames']]; print(f'Frames: {len(names)}'); print(f'Sample: {names[:5]}')"
```

Expected: 20 frames, names like `down-walk.000`, `up-walk.000`, etc.

- [ ] **Step 4: Verify tileset images exist in chat-team**

```bash
ls frontend/public/assets/tilesets/
```

Expected: `Room_Builder_32x32.png`, `interiors_pt1.png` through `interiors_pt5.png`, `blocks_1.png`

- [ ] **Step 5: Commit**

```bash
git add frontend/public/assets/sprites/atlas.png frontend/public/assets/sprites/atlas.json
git commit -m "feat: add character atlas sprites from generative_agents"
```

---

### Task 3: Install Phaser 3, Remove PixiJS Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Uninstall PixiJS dependencies**

```bash
cd frontend && npm uninstall pixi.js @pixi/react pixi-viewport @pixi/tilemap
```

- [ ] **Step 2: Install Phaser 3**

```bash
cd frontend && npm install phaser
```

- [ ] **Step 3: Verify package.json**

```bash
cd frontend && cat package.json | grep -E "phaser|pixi"
```

Expected: `phaser` present, no `pixi` entries.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors in the PixiJS-dependent files (PixiCanvas, TiledMap, AgentSprite) — that's OK, we'll fix them in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: replace pixi.js with phaser 3"
```

---

### Task 4: Create Game Types

**Files:**
- Create: `frontend/src/game/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// frontend/src/game/types.ts
import type { AgentAnimationState, AgentDirection } from '../types';

export interface GameCallbacks {
  onAgentClick: (agentId: string) => void;
  onRoomClick: (zone: string) => void;
}

export interface AgentVisual {
  sprite: Phaser.GameObjects.Sprite;
  nameText: Phaser.GameObjects.Text;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleText: Phaser.GameObjects.Text;
  bubbleBg: Phaser.GameObjects.Graphics;
  direction: AgentDirection;
  animState: AgentAnimationState;
}

export interface AgentSeat {
  x: number;
  y: number;
  tint: number;
}

/** Map from agentId to tile-coordinate seat positions */
export const AGENT_SEATS: Record<string, AgentSeat> = {
  analyst: { x: 5, y: 3, tint: 0x53c28b },
  architect: { x: 3, y: 5, tint: 0x7eb8da },
  'dev-lead': { x: 5, y: 7, tint: 0xf0a500 },
  'test-lead': { x: 1, y: 5, tint: 0xc89bda },
};

export const TILE_SIZE = 32;
export const MAP_WIDTH = 7;
export const MAP_HEIGHT = 11;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/game/types.ts
git commit -m "feat: add Phaser game types and agent seat config"
```

---

### Task 5: Create AgentSpriteFactory

**Files:**
- Create: `frontend/src/game/AgentSpriteFactory.ts`

- [ ] **Step 1: Create the factory**

```typescript
// frontend/src/game/AgentSpriteFactory.ts
import type Phaser from 'phaser';
import { TILE_SIZE, AGENT_SEATS, type AgentVisual } from './types';
import type { AgentDirection, AgentAnimationState } from '../types';

const ATLAS_KEY = 'atlas';

/** Direction map: our direction → atlas frame prefix */
const DIR_PREFIX: Record<AgentDirection, string> = {
  down: 'down',
  up: 'up',
  left: 'left',
  right: 'right',
};

export function defineAnimations(scene: Phaser.Scene) {
  const anims = scene.anims;
  const directions: AgentDirection[] = ['down', 'up', 'left', 'right'];

  for (const dir of directions) {
    const prefix = DIR_PREFIX[dir];
    anims.create({
      key: `${dir}-walk`,
      frames: anims.generateFrameNames(ATLAS_KEY, {
        prefix: `${prefix}-walk.`,
        start: 0,
        end: 3,
        zeroPad: 3,
      }),
      frameRate: 4,
      repeat: -1,
    });
  }
}

export function createAgentVisual(
  scene: Phaser.Scene,
  agentId: string,
  onClick: (id: string) => void,
): AgentVisual {
  const seat = AGENT_SEATS[agentId];
  const px = seat.x * TILE_SIZE + TILE_SIZE / 2;
  const py = seat.y * TILE_SIZE + TILE_SIZE / 2;

  // Sprite
  const sprite = scene.add.sprite(px, py, ATLAS_KEY, 'down-walk.000');
  sprite.setScale(0.8);
  sprite.setTint(seat.tint);
  sprite.setInteractive({ useHandCursor: true });
  sprite.on('pointerdown', () => onClick(agentId));
  sprite.setDepth(py);

  // Name label
  const nameText = scene.add.text(px, py + 14, agentId, {
    fontSize: '8px',
    color: '#ffffff',
    backgroundColor: '#00000088',
    padding: { x: 2, y: 1 },
  });
  nameText.setOrigin(0.5, 0);
  nameText.setDepth(py);

  // Thought bubble
  const bubbleContainer = scene.add.container(px, py - 28);
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
    sprite,
    nameText,
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

  if (state === 'walking') {
    visual.sprite.play(`${direction}-walk`, true);
  } else {
    visual.sprite.stop();
    const prefix = DIR_PREFIX[direction];
    visual.sprite.setFrame(`${prefix}-walk.000`);
  }
}

export function updateBubble(visual: AgentVisual, content: string | null) {
  if (!content) {
    visual.bubbleContainer.setVisible(false);
    return;
  }
  visual.bubbleText.setText(content.length > 30 ? content.slice(0, 30) + '…' : content);
  const tw = visual.bubbleText.width + 8;
  const th = visual.bubbleText.height + 6;
  visual.bubbleBg.clear();
  visual.bubbleBg.fillStyle(0xffffff, 0.9);
  visual.bubbleBg.fillRoundedRect(-tw / 2, -th / 2, tw, th, 4);
  visual.bubbleContainer.setVisible(true);
}

export function moveAgentTo(visual: AgentVisual, targetX: number, targetY: number, scene: Phaser.Scene) {
  const px = targetX * TILE_SIZE + TILE_SIZE / 2;
  const py = targetY * TILE_SIZE + TILE_SIZE / 2;

  scene.tweens.add({
    targets: visual.sprite,
    x: px,
    y: py,
    duration: 600,
    ease: 'Power1',
    onUpdate: () => {
      visual.sprite.setDepth(visual.sprite.y);
      visual.nameText.setPosition(visual.sprite.x, visual.sprite.y + 14);
      visual.nameText.setDepth(visual.sprite.y);
      visual.bubbleContainer.setPosition(visual.sprite.x, visual.sprite.y - 28);
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/game/AgentSpriteFactory.ts
git commit -m "feat: add AgentSpriteFactory for Phaser sprite creation and animation"
```

---

### Task 6: Create OfficeScene

**Files:**
- Create: `frontend/src/game/OfficeScene.ts`

This is the core Phaser Scene that loads the library map, creates tilemap layers, and manages agent visuals.

- [ ] **Step 1: Create the OfficeScene**

```typescript
// frontend/src/game/OfficeScene.ts
import Phaser from 'phaser';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, AGENT_SEATS, type AgentVisual, type GameCallbacks } from './types';
import { defineAnimations, createAgentVisual, playAnimation, updateBubble, moveAgentTo } from './AgentSpriteFactory';
import type { AgentAnimationState, AgentDirection } from '../types';

const SCENE_KEY = 'OfficeScene';

export class OfficeScene extends Phaser.Scene {
  private agents: Map<string, AgentVisual> = new Map();
  private callbacks!: GameCallbacks;

  constructor() {
    super({ key: SCENE_KEY });
  }

  /** Called by PhaserGame React component to wire up callbacks */
  setCallbacks(cb: GameCallbacks) {
    this.callbacks = cb;
  }

  preload() {
    // Tileset images (already in public/assets/tilesets/)
    this.load.image('blocks_1', 'assets/tilesets/blocks_1.png');
    this.load.image('Room_Builder_32x32', 'assets/tilesets/Room_Builder_32x32.png');
    this.load.image('interiors_pt1', 'assets/tilesets/interiors_pt1.png');
    this.load.image('interiors_pt2', 'assets/tilesets/interiors_pt2.png');
    this.load.image('interiors_pt3', 'assets/tilesets/interiors_pt3.png');
    this.load.image('interiors_pt4', 'assets/tilesets/interiors_pt4.png');
    this.load.image('interiors_pt5', 'assets/tilesets/interiors_pt5.png');

    // Tilemap
    this.load.tilemapTiledJSON('library', 'assets/maps/library.json');

    // Character atlas
    this.load.atlas('atlas', 'assets/sprites/atlas.png', 'assets/sprites/atlas.json');
  }

  create() {
    const map = this.make.tilemap({ key: 'library' });

    // Add tileset images to the map
    const blockTS = map.addTilesetImage('blocks_1', 'blocks_1');
    const roomTS = map.addTilesetImage('Room_Builder_32x32', 'Room_Builder_32x32');
    const int1 = map.addTilesetImage('interiors_pt1', 'interiors_pt1');
    const int2 = map.addTilesetImage('interiors_pt2', 'interiors_pt2');
    const int3 = map.addTilesetImage('interiors_pt3', 'interiors_pt3');
    const int4 = map.addTilesetImage('interiors_pt4', 'interiors_pt4');
    const int5 = map.addTilesetImage('interiors_pt5', 'interiors_pt5');

    const tilesets = [blockTS!, roomTS!, int1!, int2!, int3!, int4!, int5!];

    // Create layers in order
    const layerOrder = [
      'Bottom Ground', 'Interior Ground', 'Wall',
      'Interior Furniture L1', 'Interior Furniture L2 ',
      'Foreground L1', 'Foreground L2',
    ];
    const depthMap: Record<string, number> = {
      'Bottom Ground': 0,
      'Interior Ground': 0,
      'Wall': 1,
      'Interior Furniture L1': 2,
      'Interior Furniture L2 ': 2,
      'Foreground L1': 10,
      'Foreground L2': 10,
    };

    for (const layerName of layerOrder) {
      const layerData = map.getLayer(layerName);
      if (!layerData) continue;
      const layer = map.createLayer(layerName, tilesets, 0, 0);
      if (layer) {
        layer.setDepth(depthMap[layerName] ?? 0);
      }
    }

    // Define agent animations
    defineAnimations(this);

    // Create agent visuals
    for (const agentId of Object.keys(AGENT_SEATS)) {
      const visual = createAgentVisual(this, agentId, (id) => {
        this.callbacks?.onAgentClick(id);
      });
      this.agents.set(agentId, visual);
    }

    // Camera: center on the map, fit to viewport
    const cx = (MAP_WIDTH * TILE_SIZE) / 2;
    const cy = (MAP_HEIGHT * TILE_SIZE) / 2;
    this.cameras.main.centerOn(cx, cy);
    // Scale camera so the map fills the viewport with some padding
    const zoomX = (this.scale.width - 40) / (MAP_WIDTH * TILE_SIZE);
    const zoomY = (this.scale.height - 40) / (MAP_HEIGHT * TILE_SIZE);
    this.cameras.main.setZoom(Math.min(zoomX, zoomY));

    // Re-center on resize
    this.scale.on('resize', (_gameSize: Phaser.Structs.Size) => {
      const zx = (this.scale.width - 40) / (MAP_WIDTH * TILE_SIZE);
      const zy = (this.scale.height - 40) / (MAP_HEIGHT * TILE_SIZE);
      this.cameras.main.setZoom(Math.min(zx, zy));
      this.cameras.main.centerOn(cx, cy);
    });
  }

  update(_time: number, _delta: number) {
    // Agent state updates are driven by React via setAgent* methods
  }

  // --- Public API called from React ---

  setAgentState(agentId: string, state: AgentAnimationState) {
    const visual = this.agents.get(agentId);
    if (visual) playAnimation(visual, state, visual.direction);
  }

  setAgentDirection(agentId: string, direction: AgentDirection) {
    const visual = this.agents.get(agentId);
    if (visual) playAnimation(visual, visual.animState, direction);
  }

  setAgentThinking(agentId: string, content: string | null) {
    const visual = this.agents.get(agentId);
    if (visual) updateBubble(visual, content);
  }

  setAgentPosition(agentId: string, tileX: number, tileY: number) {
    const visual = this.agents.get(agentId);
    if (visual) moveAgentTo(visual, tileX, tileY, this);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/game/OfficeScene.ts
git commit -m "feat: add OfficeScene Phaser scene with library tilemap and agent sprites"
```

---

### Task 7: Create PhaserGame React Component

**Files:**
- Create: `frontend/src/components/canvas/PhaserGame.tsx`

- [ ] **Step 1: Create the component**

```typescript
// frontend/src/components/canvas/PhaserGame.tsx
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { OfficeScene } from '../../game/OfficeScene';
import { useAgentStore } from '../../stores/agentStore';
import { useUiStore } from '../../stores/uiStore';
import type { AgentAnimationState, AgentDirection } from '../../types';

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const scene = new OfficeScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      parent: containerRef.current,
      pixelArt: true,
      backgroundColor: '#1a1a2e',
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 } },
      },
      scene: scene,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    scene.setCallbacks({
      onAgentClick: (agentId: string) => {
        useUiStore.getState().setSelectedAgent(agentId);
      },
      onRoomClick: (_zone: string) => {},
    });

    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // Sync agent store state into Phaser
  const agents = useAgentStore((s) => s.agents);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !scene.scene.isActive()) return;

    for (const [agentId, state] of Object.entries(agents)) {
      if (state.animationState) {
        scene.setAgentState(agentId, state.animationState as AgentAnimationState);
      }
      if (state.direction) {
        scene.setAgentDirection(agentId, state.direction as AgentDirection);
      }
      scene.setAgentThinking(agentId, state.thinkingContent);
      if (state.targetPosition) {
        scene.setAgentPosition(agentId, state.targetPosition.x, state.targetPosition.y);
      }
    }
  }, [agents]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/canvas/PhaserGame.tsx
git commit -m "feat: add PhaserGame React wrapper component"
```

---

### Task 8: Create CelebrationEffect for Phaser

**Files:**
- Create: `frontend/src/components/canvas/CelebrationEffect.tsx`

Reimplement the confetti celebration using Phaser tweens instead of PixiJS Graphics. This component watches `sessionStore.activeSession.status` and triggers a Phaser-based celebration when status becomes `completed`.

- [ ] **Step 1: Create the component**

```typescript
// frontend/src/components/canvas/CelebrationEffect.tsx
import { useEffect, useRef } from 'react';
import { useSessionStore } from '../../stores/sessionStore';

const COLORS = [0x53c28b, 0x7eb8da, 0xf0a500, 0xc89bda, 0xff6b6b, 0x88ccff];
const PARTICLE_COUNT = 40;

export function CelebrationEffect() {
  const prevStatusRef = useRef<string | null>(null);
  const sceneRef = useRef<Phaser.Scene | null>(null);

  // Get scene reference from the global game instance
  useEffect(() => {
    const interval = setInterval(() => {
      const game = (window as any).__phaser_game as Phaser.Game | undefined;
      if (game) {
        sceneRef.current = game.scene.getScene('OfficeScene');
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const status = useSessionStore((s) => s.activeSession?.status ?? null);

  useEffect(() => {
    if (status === 'completed' && prevStatusRef.current !== 'completed') {
      triggerCelebration();
    }
    prevStatusRef.current = status ?? null;
  }, [status]);

  function triggerCelebration() {
    const scene = sceneRef.current;
    if (!scene) return;

    const cx = (scene.scale.width / scene.cameras.main.zoom) / 2;
    const cy = (scene.scale.height / scene.cameras.main.zoom) / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const rect = scene.add.rectangle(
        cx + (Math.random() - 0.5) * 40,
        cy + (Math.random() - 0.5) * 20,
        4 + Math.random() * 4,
        4 + Math.random() * 4,
        COLORS[Math.floor(Math.random() * COLORS.length)],
      );
      rect.setDepth(100);

      scene.tweens.add({
        targets: rect,
        x: rect.x + (Math.random() - 0.5) * 300,
        y: rect.y + Math.random() * 200,
        alpha: 0,
        angle: Math.random() * 360,
        duration: 1200 + Math.random() * 800,
        ease: 'Power2',
        onComplete: () => rect.destroy(),
      });
    }
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/canvas/CelebrationEffect.tsx
git commit -m "feat: add Phaser-based celebration effect"
```

---

### Task 9: Create FlyingDocument for Phaser

**Files:**
- Create: `frontend/src/components/canvas/FlyingDocument.tsx`

Reimplement the flying document animation using Phaser tweens. Watches agent output files and animates a document icon from the agent position to the archive area.

- [ ] **Step 1: Create the component**

```typescript
// frontend/src/components/canvas/FlyingDocument.tsx
import { useEffect, useRef } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { AGENT_SEATS, TILE_SIZE } from '../../game/types';

export function FlyingDocument() {
  const prevFilesRef = useRef<Record<string, number>>({});
  const sceneRef = useRef<Phaser.Scene | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const game = (window as any).__phaser_game as Phaser.Game | undefined;
      if (game) {
        sceneRef.current = game.scene.getScene('OfficeScene');
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const agents = useAgentStore((s) => s.agents);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    for (const [agentId, state] of Object.entries(agents)) {
      const prevCount = prevFilesRef.current[agentId] ?? 0;
      const currCount = state.outputFiles.length;
      if (currCount > prevCount) {
        spawnFlyingDoc(scene, agentId);
      }
      prevFilesRef.current[agentId] = currCount;
    }
  }, [agents]);

  function spawnFlyingDoc(scene: Phaser.Scene, agentId: string) {
    const seat = AGENT_SEATS[agentId];
    if (!seat) return;

    const fromX = seat.x * TILE_SIZE + TILE_SIZE / 2;
    const fromY = seat.y * TILE_SIZE + TILE_SIZE / 2;
    const toX = 3 * TILE_SIZE;
    const toY = 10 * TILE_SIZE;

    const doc = scene.add.rectangle(fromX, fromY, 10, 12, 0xfff8dc);
    doc.setStrokeStyle(1, 0x999999);
    doc.setDepth(100);

    scene.tweens.add({
      targets: doc,
      x: toX,
      y: { value: [fromY, fromY - 40, toY], interpolation: 'Bezier' },
      alpha: { from: 1, to: 0.6 },
      duration: 800,
      ease: 'Power1',
      onComplete: () => doc.destroy(),
    });
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/canvas/FlyingDocument.tsx
git commit -m "feat: add Phaser-based flying document animation"
```

---

### Task 10: Update agentStore (verify)

**Files:**
- Modify: `frontend/src/stores/agentStore.ts`

Remove PixiJS-specific references. The store interface stays the same — it never imported PixiJS directly, but we verify and clean up.

- [ ] **Step 1: Read current agentStore**

```bash
cat frontend/src/stores/agentStore.ts
```

Verify it has no PixiJS imports. The store should only import from `zustand` and `../types`.

- [ ] **Step 2: If any PixiJS references exist, remove them**

The store likely doesn't import PixiJS directly — it only stores plain state. Verify and move on if clean.

- [ ] **Step 3: Commit if changed, otherwise skip**

```bash
git add frontend/src/stores/agentStore.ts
git diff --cached --quiet || git commit -m "refactor: clean up agentStore for Phaser compatibility"
```

---

### Task 11: Update App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

Replace PixiJS canvas components with the new PhaserGame component.

- [ ] **Step 1: Update App.tsx**

Replace the current content with:

```typescript
// frontend/src/App.tsx
import { PhaserGame } from './components/canvas/PhaserGame';
import { CelebrationEffect } from './components/canvas/CelebrationEffect';
import { FlyingDocument } from './components/canvas/FlyingDocument';
import { NewTaskModal } from './components/overlay/NewTaskModal';
import { StatusBar } from './components/overlay/StatusBar';
import { AgentDetailPanel } from './components/overlay/AgentDetailPanel';
import { DocViewer } from './components/overlay/DocViewer';
import { ArchiveDrawer } from './components/overlay/ArchiveDrawer';
import { useSessionStore } from './stores/sessionStore';
import { useWebSocket } from './hooks/useWebSocket';

export default function App() {
  const activeSessionId = useSessionStore((s) => s.activeSession?.id ?? null);
  useWebSocket(activeSessionId);

  return (
    <div className="w-full h-full relative">
      <PhaserGame />
      <CelebrationEffect />
      <FlyingDocument />
      <NewTaskModal />
      <StatusBar />
      <AgentDetailPanel />
      <DocViewer />
      <ArchiveDrawer />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: replace PixiJS canvas with PhaserGame in App"
```

---

### Task 12: Delete Old PixiJS Components

**Files:**
- Delete: `frontend/src/components/canvas/PixiCanvas.tsx`
- Delete: `frontend/src/components/canvas/TiledMap.tsx`
- Delete: `frontend/src/components/canvas/AgentSprite.tsx`
- Delete: `frontend/src/components/canvas/CelebrationEffect.tsx`
- Delete: `frontend/src/components/canvas/FlyingDocument.tsx`
- Delete: `frontend/src/utils/tmxLoader.ts`
- Delete: `frontend/src/data/mapConfig.ts`
- Delete: `frontend/src/data/agentConfig.ts`
- Delete: `frontend/src/data/spritesheets/` (directory)
- Delete: `frontend/public/assets/maps/the_office.json`

- [ ] **Step 1: Delete files**

```bash
cd D:\code\chat-team
rm frontend/src/components/canvas/PixiCanvas.tsx
rm frontend/src/components/canvas/TiledMap.tsx
rm frontend/src/components/canvas/AgentSprite.tsx
rm frontend/src/components/canvas/CelebrationEffect.tsx
rm frontend/src/components/canvas/FlyingDocument.tsx
rm frontend/src/utils/tmxLoader.ts
rm frontend/src/data/mapConfig.ts
rm frontend/src/data/agentConfig.ts
rm -rf frontend/src/data/spritesheets/
rm frontend/public/assets/maps/the_office.json
```

- [ ] **Step 2: Search for stale imports**

```bash
grep -r "PixiCanvas\|TiledMap\|AgentSprite\|CelebrationEffect\|FlyingDocument\|tmxLoader\|mapConfig\|agentConfig\|spritesheets\|pixi" frontend/src/ --include="*.ts" --include="*.tsx" -l
```

Fix any remaining imports found. Likely files that import `AGENT_SEATS` or `MAP_CONFIG` need updating — they should now import from `game/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove PixiJS canvas components and old map config"
```

---

### Task 13: Verify TypeScript Compilation

- [ ] **Step 1: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Fix any type errors. Common issues:
- Missing type exports from `../types` (ensure `AgentAnimationState`, `AgentDirection` exist)
- Phaser type imports

- [ ] **Step 2: Commit fixes if needed**

```bash
git add -A
git diff --cached --quiet || git commit -m "fix: resolve TypeScript compilation errors"
```

---

### Task 14: Run Dev Server and Visual Verification

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Open browser at http://localhost:3000**

Verify:
- Library room renders with walls, floor, furniture
- 4 agent sprites visible at their seat positions with tint colors
- Agent name labels visible below sprites
- Clicking an agent opens the AgentDetailPanel
- WebSocket events update agent states (thinking bubbles, animation)
- Overlay components (StatusBar, NewTaskModal) still work

- [ ] **Step 3: Check browser console for errors**

Open DevTools → Console. Fix any errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git diff --cached --quiet || git commit -m "fix: resolve runtime rendering issues"
```

---

### Task 15: Run Tests

- [ ] **Step 1: Run existing tests**

```bash
cd frontend && npm run test
```

Fix any broken tests. Tests that import from deleted files need updating.

- [ ] **Step 2: Commit fixes**

```bash
git add -A
git diff --cached --quiet || git commit -m "fix: update tests for Phaser migration"
```

---

### Task 16: Final Cleanup

- [ ] **Step 1: Verify no PixiJS remnants**

```bash
grep -r "pixi\|@pixi" frontend/ --include="*.ts" --include="*.tsx" --include="*.json" -l
```

Should return no results (except possibly in node_modules or lock files).

- [ ] **Step 2: Verify build succeeds**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore: final cleanup after Phaser 3 migration"
```
