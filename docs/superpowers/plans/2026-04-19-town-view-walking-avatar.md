# 全小镇视角 + 随机漫步 + Analyst 头像 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端三个改动：全小镇自由视角摄像机、空闲时图书馆内随机漫步、analyst 详情面板显示 Mei Lin 头像。

**Architecture:** 在现有 Phaser 场景基础上，修改摄像机配置实现全览+拖拽缩放；新增 `RandomWalker` 类封装漫步状态机，在 `OfficeScene` 的 `update` 循环中驱动；复制头像资源并在 React 组件中引用。

**Tech Stack:** Phaser 3, React 18, TypeScript, TailwindCSS

**Spec:** `docs/superpowers/specs/2026-04-19-town-view-and-walking-design.md`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/game/OfficeScene.ts` | Modify | 全小镇摄像机 + 拖拽缩放 + 集成 walker |
| `frontend/src/game/RandomWalker.ts` | Create | 漫步状态机类 |
| `frontend/src/game/types.ts` | Modify | 添加碰撞网格常量和 walker 类型 |
| `frontend/src/components/canvas/PhaserGame.tsx` | Modify | 连接 agent 状态变化到 walker 启停 |
| `frontend/public/assets/avatars/analyst.png` | Create | Mei Lin 头像文件 |
| `frontend/src/components/overlay/AgentDetailPanel.tsx` | Modify | 显示 analyst 头像 |

---

### Task 1: 全小镇自由视角摄像机

**Files:**
- Modify: `frontend/src/game/OfficeScene.ts`

- [ ] **Step 1: 替换摄像机初始化逻辑**

在 `OfficeScene.ts` 的 `create()` 方法中，替换当前的摄像机聚焦代码（第 130-154 行），改为全小镇视角 + 拖拽缩放。

删除以下代码块（第 130-154 行）：

```typescript
    // Camera — center on the library room
    const cx = (LIB_X + LIB_W / 2) * TILE_SIZE;
    const cy = (LIB_Y + LIB_H / 2) * TILE_SIZE;
    this.cameras.main.centerOn(cx, cy);

    // Zoom to show just the library room with padding
    const zx = (this.scale.width - 40) / (LIB_W * TILE_SIZE);
    const zy = (this.scale.height - 40) / (LIB_H * TILE_SIZE);
    this.cameras.main.setZoom(Math.min(zx, zy));

    // Clamp camera so user can't scroll too far
    const margin = 3 * TILE_SIZE;
    this.cameras.main.setBounds(
      (LIB_X - margin / TILE_SIZE) * TILE_SIZE,
      (LIB_Y - margin / TILE_SIZE) * TILE_SIZE,
      (LIB_W + 2 * margin / TILE_SIZE) * TILE_SIZE,
      (LIB_H + 2 * margin / TILE_SIZE) * TILE_SIZE,
    );

    this.scale.on('resize', () => {
      const zx2 = (this.scale.width - 40) / (LIB_W * TILE_SIZE);
      const zy2 = (this.scale.height - 40) / (LIB_H * TILE_SIZE);
      this.cameras.main.setZoom(Math.min(zx2, zy2));
      this.cameras.main.centerOn(cx, cy);
    });
```

替换为：

```typescript
    // Camera — full town view with drag & zoom
    const FULL_W = 140;
    const FULL_H = 100;
    const mapPixelW = FULL_W * TILE_SIZE;
    const mapPixelH = FULL_H * TILE_SIZE;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, mapPixelW, mapPixelH);

    // Fit entire map in viewport
    const fitZoom = Math.min(this.scale.width / mapPixelW, this.scale.height / mapPixelH);
    cam.setZoom(fitZoom);
    cam.centerOn(mapPixelW / 2, mapPixelH / 2);

    const MIN_ZOOM = fitZoom;
    const MAX_ZOOM = 3;

    // Drag to pan
    let dragStartX = 0;
    let dragStartY = 0;
    let camStartX = 0;
    let camStartY = 0;
    let dragging = false;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      dragging = true;
      dragStartX = pointer.x;
      dragStartY = pointer.y;
      camStartX = cam.scrollX;
      camStartY = cam.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dx = (pointer.x - dragStartX) / cam.zoom;
      const dy = (pointer.y - dragStartY) / cam.zoom;
      cam.scrollX = camStartX - dx;
      cam.scrollY = camStartY - dy;
    });

    this.input.on('pointerup', () => {
      dragging = false;
    });

    // Scroll to zoom (toward pointer)
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any[], _dx: number, dy: number) => {
      const zoomFactor = dy > 0 ? 0.9 : 1.1;
      const newZoom = Phaser.Math.Clamp(cam.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);

      // Zoom toward pointer position
      const worldX = cam.getWorldPoint(_pointer.x, _pointer.y);
      cam.setZoom(newZoom);
      cam.centerOn(
        worldX.x + (cam.midPoint.x - worldX.x),
        worldX.y + (cam.midPoint.y - worldY.y),
      );
    });

    this.scale.on('resize', () => {
      const newFitZoom = Math.min(this.scale.width / mapPixelW, this.scale.height / mapPixelH);
      cam.setZoom(newFitZoom);
      cam.centerOn(mapPixelW / 2, mapPixelH / 2);
    });
```

注意：上面的 `wheel` handler 中有一个 typo (`worldY` 应为 `worldX`)，正确版本：

```typescript
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any[], _dx: number, dy: number) => {
      const zoomFactor = dy > 0 ? 0.9 : 1.1;
      const newZoom = Phaser.Math.Clamp(cam.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);

      const worldPoint = cam.getWorldPoint(_pointer.x, _pointer.y);
      const oldMidX = cam.midPoint.x;
      const oldMidY = cam.midPoint.y;
      cam.setZoom(newZoom);
      cam.centerOn(
        worldPoint.x + (oldMidX - worldPoint.x),
        worldPoint.y + (oldMidY - worldPoint.y),
      );
    });
```

- [ ] **Step 2: 启动前端 dev 服务器并验证**

Run: `cd frontend && npm run dev`

在浏览器中打开 http://localhost:3000，验证：
- 可以看到整个小镇地图（不是只有图书馆）
- 鼠标拖拽可以平移视角
- 滚轮可以缩放
- 四个 agent 精灵仍然可见在图书馆位置

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/OfficeScene.ts
git commit -m "feat: full town camera with drag pan and scroll zoom"
```

---

### Task 2: 图书馆碰撞网格

**Files:**
- Modify: `frontend/src/game/types.ts`

- [ ] **Step 1: 添加碰撞网格常量**

在 `types.ts` 末尾添加图书馆区域的可行走网格。数据来源：从 `the_ville.json` 的 Collisions layer 提取 (col 118-124, row 19-29)。

每个 agent 的座位位置也要标记为可行走（即使它在 collision 层有值，因为 agent 是"坐在桌前"）。

```typescript
// Library collision grid (7 cols x 11 rows, from Collisions layer).
// false = walkable, true = blocked.
// Extracted from the_ville.json Collisions layer at (118,19).
const LIB_COLLISIONS_RAW: boolean[][] = [
  [true,  true,  true,  true,  true,  true,  true ],  // row 0 (top wall)
  [false, false, false, false, false, false, false],  // row 1
  [false, false, false, false, false, false, false],  // row 2
  [false, false, true,  true,  false, false, false],  // row 3 (tables)
  [false, false, true,  true,  false, false, false],  // row 4
  [false, false, true,  true,  false, false, false],  // row 5
  [false, false, false, false, false, false, true ],  // row 6
  [false, false, false, false, false, false, true ],  // row 7
  [false, false, false, false, false, false, true ],  // row 8
  [true,  false, false, true,  true,  true,  true ],  // row 9
  [true,  false, false, true,  true,  true,  true ],  // row 10
];

// Seat positions are always valid (agents sit at desks which are on collision tiles)
export function isLibraryWalkable(col: number, row: number): boolean {
  if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) return false;
  // Check if this is a seat position — seats are always walkable for returning to
  for (const seat of Object.values(AGENT_SEATS)) {
    if (seat.x === col && seat.y === row) return true;
  }
  return !LIB_COLLISIONS_RAW[row][col];
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/game/types.ts
git commit -m "feat: add library collision grid and isLibraryWalkable helper"
```

---

### Task 3: RandomWalker 类

**Files:**
- Create: `frontend/src/game/RandomWalker.ts`

- [ ] **Step 1: 创建 RandomWalker 类**

创建 `frontend/src/game/RandomWalker.ts`：

```typescript
import type Phaser from 'phaser';
import { TILE_SIZE, AGENT_SEATS, isLibraryWalkable } from './types';
import type { AgentVisual } from './types';
import type { AgentAnimationState, AgentDirection } from '../types';
import { playAnimation } from './AgentSpriteFactory';

type WalkerState = 'seated' | 'walking' | 'returning';

const LIB_X = 118;
const LIB_Y = 19;
const DIRS: AgentDirection[] = ['up', 'down', 'left', 'right'];
const DIR_DELTA: Record<AgentDirection, { dx: number; dy: number }> = {
  up:    { dx: 0,  dy: -1 },
  down:  { dx: 0,  dy: 1 },
  left:  { dx: -1, dy: 0 },
  right: { dx: 1,  dy: 0 },
};

export class RandomWalker {
  private visual: AgentVisual;
  private scene: Phaser.Scene;
  private state: WalkerState = 'seated';
  private agentState: AgentAnimationState = 'idle';

  // Current position in room-local coords (col, row)
  private col: number;
  private row: number;
  private readonly seatCol: number;
  private readonly seatRow: number;

  private waitTimer = 0;
  private walkTween: Phaser.Tweens.Tween | null = null;

  constructor(visual: AgentVisual, scene: Phaser.Scene) {
    this.visual = visual;
    this.scene = scene;
    const seat = AGENT_SEATS[visual.agentId]!;
    this.seatCol = seat.x;
    this.seatRow = seat.y;
    this.col = seat.x;
    this.row = seat.y;
  }

  /** Called from OfficeScene.update() each frame */
  update(delta: number) {
    if (this.agentState !== 'idle') return;
    if (this.state === 'walking' || this.state === 'returning') return;

    this.waitTimer -= delta;
    if (this.waitTimer <= 0) {
      this.startWalk();
    }
  }

  /** External agent state change (idle/working/thinking) */
  setAgentState(state: AgentAnimationState) {
    const wasActive = this.agentState !== 'idle';
    this.agentState = state;

    if (state !== 'idle' && this.state !== 'seated') {
      // Agent started working/thinking — return to seat
      this.returnToSeat();
    } else if (state === 'idle' && !wasActive) {
      // Agent became idle — start wait timer
      this.scheduleNextWalk();
    }
  }

  private scheduleNextWalk() {
    this.waitTimer = 2000 + Math.random() * 3000; // 2-5 seconds
  }

  private startWalk() {
    // Pick random walkable direction
    const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
    let chosen: AgentDirection | null = null;

    for (const dir of shuffled) {
      const { dx, dy } = DIR_DELTA[dir];
      const nc = this.col + dx;
      const nr = this.row + dy;
      if (isLibraryWalkable(nc, nr)) {
        chosen = dir;
        this.col = nc;
        this.row = nr;
        break;
      }
    }

    if (!chosen) {
      // All directions blocked — wait and retry
      this.scheduleNextWalk();
      return;
    }

    this.state = 'walking';
    playAnimation(this.visual, 'walking', chosen);

    const px = (LIB_X + this.col) * TILE_SIZE + TILE_SIZE / 2;
    const py = (LIB_Y + this.row) * TILE_SIZE + TILE_SIZE / 2;

    this.walkTween = this.scene.tweens.add({
      targets: this.visual.sprite,
      x: px,
      y: py,
      duration: 300,
      ease: 'Linear',
      onUpdate: () => {
        this.visual.sprite.setDepth(this.visual.sprite.y);
        this.visual.nameText.setPosition(this.visual.sprite.x, this.visual.sprite.y + 14);
        this.visual.nameText.setDepth(this.visual.sprite.y);
        this.visual.bubbleContainer.setPosition(this.visual.sprite.x, this.visual.sprite.y - 28);
      },
      onComplete: () => {
        this.walkTween = null;
        playAnimation(this.visual, 'idle', chosen!);
        this.state = 'seated';
        // Decide whether to walk again or pause
        if (Math.random() < 0.7) {
          this.scheduleNextWalk(); // 70% chance keep walking
        } else {
          this.waitTimer = 3000 + Math.random() * 4000; // 30% chance longer pause
        }
      },
    });
  }

  private returnToSeat() {
    if (this.walkTween) {
      this.walkTween.stop();
      this.walkTween = null;
    }

    this.col = this.seatCol;
    this.row = this.seatRow;
    this.state = 'returning';

    const px = (LIB_X + this.seatCol) * TILE_SIZE + TILE_SIZE / 2;
    const py = (LIB_Y + this.seatRow) * TILE_SIZE + TILE_SIZE / 2;

    playAnimation(this.visual, 'walking', this.visual.direction);

    this.scene.tweens.add({
      targets: this.visual.sprite,
      x: px,
      y: py,
      duration: 600,
      ease: 'Power1',
      onUpdate: () => {
        this.visual.sprite.setDepth(this.visual.sprite.y);
        this.visual.nameText.setPosition(this.visual.sprite.x, this.visual.sprite.y + 14);
        this.visual.nameText.setDepth(this.visual.sprite.y);
        this.visual.bubbleContainer.setPosition(this.visual.sprite.x, this.visual.sprite.y - 28);
      },
      onComplete: () => {
        playAnimation(this.visual, 'idle', 'down');
        this.state = 'seated';
        this.scheduleNextWalk();
      },
    });
  }

  destroy() {
    if (this.walkTween) {
      this.walkTween.stop();
      this.walkTween = null;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/game/RandomWalker.ts
git commit -m "feat: add RandomWalker class for idle library walking"
```

---

### Task 4: 集成 RandomWalker 到 OfficeScene

**Files:**
- Modify: `frontend/src/game/OfficeScene.ts`

- [ ] **Step 1: 导入 RandomWalker 并添加 walker 管理代码**

在 `OfficeScene.ts` 顶部添加导入：

```typescript
import { RandomWalker } from './RandomWalker';
```

在 `OfficeScene` 类中添加字段（在 `private callbacks` 后面）：

```typescript
  private walkers: Map<string, RandomWalker> = new Map();
```

在 `create()` 方法中，agent 创建循环之后（第 128 行后），添加：

```typescript
    // Initialize walkers for idle wandering
    for (const [agentId, visual] of this.agents) {
      this.walkers.set(agentId, new RandomWalker(visual, this));
    }
```

在 `update()` 方法中添加 walker 更新：

```typescript
  update(_time: number, delta: number) {
    for (const walker of this.walkers.values()) {
      walker.update(delta);
    }
  }
```

修改 `setAgentState()` 方法，通知 walker：

```typescript
  setAgentState(agentId: string, state: AgentAnimationState) {
    const visual = this.agents.get(agentId);
    if (visual) playAnimation(visual, state, visual.direction);
    const walker = this.walkers.get(agentId);
    if (walker) walker.setAgentState(state);
  }
```

- [ ] **Step 2: 启动 dev 服务器验证**

Run: `cd frontend && npm run dev`

在浏览器中验证：
- 四个 agent 在空闲时会在图书馆内随机走动
- 碰到墙壁/家具会换方向
- 走几步后会停下来，然后继续走
- 不会走出图书馆范围

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/OfficeScene.ts
git commit -m "feat: integrate RandomWalker into OfficeScene"
```

---

### Task 5: 连接 agentStore 状态到 walker 启停

**Files:**
- Modify: `frontend/src/components/canvas/PhaserGame.tsx`

- [ ] **Step 1: 确保状态变化传递到 walker**

当前 `PhaserGame.tsx` 已经通过 `useEffect` 监听 `agents` 状态变化并调用 `scene.setAgentState()`。Task 4 中 `setAgentState` 已经会通知 walker，所以这条通路已经打通。

但需要验证：当 agent 从 idle 变为 working/thinking 时，walker 是否正确停止。当 agent 从 working/thinking 变回 idle 时，walker 是否重新启动。

检查 `agentStore.ts` 中的状态流转：
- `agent:thinking` → animationState = 'thinking'
- `agent:working` → animationState = 'working'
- `agent:completed` → animationState = 'idle'

这个流转与 `RandomWalker.setAgentState()` 的逻辑一致。无需额外修改 `PhaserGame.tsx`。

但有一个问题：`PhaserGame.tsx` 中的 `useEffect` 只在 `agents` 状态变化时触发，如果 `animationState` 没有变化（比如从 'idle' 到 'idle'），walker 不会被通知。这在 `agent:completed` 事件后 animationState 回到 'idle' 时是正确的（之前是 working/thinking，现在是 idle）。

不需要修改此文件。跳过。

- [ ] **Step 2: Commit（无代码变更，跳过）**

---

### Task 6: Analyst Mei Lin 头像

**Files:**
- Create: `frontend/public/assets/avatars/analyst.png`
- Modify: `frontend/src/components/overlay/AgentDetailPanel.tsx`

- [ ] **Step 1: 复制 Mei Lin 头像**

```bash
mkdir -p frontend/public/assets/avatars
cp "D:/code/generative_agents/environment/frontend_server/static_dirs/assets/characters/Mei_Lin.png" frontend/public/assets/avatars/analyst.png
```

- [ ] **Step 2: 在 AgentDetailPanel 中显示头像**

修改 `AgentDetailPanel.tsx`，在头部添加头像显示。

在文件顶部（`AGENT_COLORS` 之后）添加头像映射：

```typescript
const AGENT_AVATARS: Record<string, string> = {
  analyst: '/assets/avatars/analyst.png',
};
```

在 return JSX 中，替换 header 部分（第 28-35 行）：

```typescript
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {AGENT_AVATARS[agentId] && (
              <img
                src={AGENT_AVATARS[agentId]}
                alt={agentId}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
              />
            )}
            <h3 className={`text-lg font-semibold ${AGENT_COLORS[agentId] ?? 'text-white'}`}>
              {AGENT_NAMES[agentId] ?? agentId}
            </h3>
          </div>
          <button className="text-gray-400 hover:text-white" onClick={close}>
            ✕
          </button>
        </div>
```

- [ ] **Step 3: 验证**

Run: `cd frontend && npm run dev`

点击 analyst 精灵，确认右侧详情面板显示 Mei Lin 头像（圆形，48x48px）。

- [ ] **Step 4: Commit**

```bash
git add frontend/public/assets/avatars/analyst.png frontend/src/components/overlay/AgentDetailPanel.tsx
git commit -m "feat: add Mei Lin avatar for analyst in detail panel"
```

---

## Self-Review

**Spec coverage:**
- 全小镇自由视角 → Task 1 ✓
- 碰撞网格 → Task 2 ✓
- 随机漫步状态机 → Task 3 ✓
- 集成到场景 → Task 4 ✓
- 状态集成（工作/思考回座位） → Task 4 + Task 5 ✓
- Mei Lin 头像 → Task 6 ✓

**Placeholder scan:** 无 TBD/TODO。

**Type consistency:**
- `isLibraryWalkable(col, row)` 在 types.ts 定义，RandomWalker.ts 调用 — 参数名一致 ✓
- `playAnimation(visual, state, direction)` 签名在 AgentSpriteFactory.ts 定义，RandomWalker.ts 调用 — 一致 ✓
- `RandomWalker.setAgentState(state: AgentAnimationState)` 参数类型与 scene 的 `setAgentState` 一致 ✓
- `AGENT_SEATS` 类型 `Record<string, AgentSeat>` 在 types.ts，RandomWalker 和 OfficeScene 都从此导入 ✓

**Bug fix:** Step 1 中 wheel handler 的 `worldY` typo 已在正确版本中修复为 `worldPoint.y`。
