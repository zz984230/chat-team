# Canvas 层游戏化改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 Canvas 层，实现 AI Town 风格的角色精灵动画、程序化办公室地图、视口控制和视觉特效。

**Architecture:** 使用半命令式 PixiJS 架构 — @pixi/react 的 Stage 管理画布生命周期，pixi-viewport 通过命令式 API 创建，子组件通过 Viewport Context 获取视口引用并添加 PixiJS 对象。Zustand store 驱动动画状态。

**Tech Stack:** PixiJS 7 + @pixi/react 7 + pixi-viewport 5 + Zustand 5

**Spec:** `docs/superpowers/specs/2026-04-15-canvas-gameification-design.md`

---

### Task 1: 下载 AI Town 精灵图资源

**Files:**
- Create: `frontend/public/assets/32x32folk.png`

AI Town 使用一张共享精灵图 `32x32folk.png`（MIT 协议），所有角色在同一张图中定义不同区域。

- [ ] **Step 1: 创建 assets 目录并下载精灵图**

```bash
mkdir -p /Users/zero/Project/chat-team/frontend/public/assets
curl -L -o /Users/zero/Project/chat-team/frontend/public/assets/32x32folk.png \
  "https://raw.githubusercontent.com/a16z-infra/ai-town/main/public/assets/32x32folk.png"
```

- [ ] **Step 2: 验证文件已下载**

```bash
ls -la /Users/zero/Project/chat-team/frontend/public/assets/32x32folk.png
file /Users/zero/Project/chat-team/frontend/public/assets/32x32folk.png
```

Expected: 文件存在且为 PNG 图像

- [ ] **Step 3: 替换 spritesheet 帧数据文件**

需要从 AI Town 仓库下载 f1.ts、f3.ts、f4.ts、f6.ts 的帧定义（它们定义了同一张 `32x32folk.png` 中的不同区域坐标）。我们的现有文件是 16×16 帧，AI Town 实际使用 32×32 帧。

先下载原始文件查看实际帧坐标：

```bash
curl -sL "https://raw.githubusercontent.com/a16z-infra/ai-town/main/data/spritesheets/f1.ts" | head -30
```

然后将 f1.ts、f3.ts、f4.ts、f6.ts 替换为 AI Town 版本，并将 `meta.image` 改为指向 `/assets/32x32folk.png`。

每个文件格式如下（以 f1 为例）：

```typescript
import type { ISpritesheetData } from 'pixi.js';

export const spritesheetData: ISpritesheetData = {
  frames: {
    'down-0': { frame: { x: <COL1>, y: <ROW1>, w: 32, h: 32 } },
    'down-1': { frame: { x: <COL2>, y: <ROW1>, w: 32, h: 32 } },
    'down-2': { frame: { x: <COL3>, y: <ROW1>, w: 32, h: 32 } },
    'up-0': { frame: { x: <COL1>, y: <ROW2>, w: 32, h: 32 } },
    'up-1': { frame: { x: <COL2>, y: <ROW2>, w: 32, h: 32 } },
    'up-2': { frame: { x: <COL3>, y: <ROW2>, w: 32, h: 32 } },
    'right-0': { frame: { x: <COL1>, y: <ROW3>, w: 32, h: 32 } },
    'right-1': { frame: { x: <COL2>, y: <ROW3>, w: 32, h: 32 } },
    'right-2': { frame: { x: <COL3>, y: <ROW3>, w: 32, h: 32 } },
    'left-0': { frame: { x: <COL1>, y: <ROW4>, w: 32, h: 32 } },
    'left-1': { frame: { x: <COL2>, y: <ROW4>, w: 32, h: 32 } },
    'left-2': { frame: { x: <COL3>, y: <ROW4>, w: 32, h: 32 } },
  },
  animations: {
    'down': ['down-0', 'down-1', 'down-2'],
    'up': ['up-0', 'up-1', 'up-2'],
    'right': ['right-0', 'right-1', 'right-2'],
    'left': ['left-0', 'left-1', 'left-2'],
  },
  meta: {
    image: '/assets/32x32folk.png',
    scale: '1',
  },
};
```

具体坐标值从 AI Town 原始文件复制，只需修改 `meta.image` 路径。

- [ ] **Step 4: 更新 agentConfig.ts 的 spriteUrl**

```typescript
// src/data/agentConfig.ts
export interface AgentVisualConfig {
  agentId: string;
  spriteKey: string;
  spriteUrl: string;
  room: string;
  position: { x: number; y: number };
}

export const AGENT_CONFIGS: Record<string, AgentVisualConfig> = {
  analyst: {
    agentId: 'analyst',
    spriteKey: 'f1',
    spriteUrl: '/assets/32x32folk.png',
    room: 'meeting',
    position: { x: 5, y: 5 },
  },
  architect: {
    agentId: 'architect',
    spriteKey: 'f4',
    spriteUrl: '/assets/32x32folk.png',
    room: 'design',
    position: { x: 5, y: 4 },
  },
  researcher: {
    agentId: 'researcher',
    spriteKey: 'f6',
    spriteUrl: '/assets/32x32folk.png',
    room: 'design',
    position: { x: 9, y: 4 },
  },
  writer: {
    agentId: 'writer',
    spriteKey: 'f3',
    spriteUrl: '/assets/32x32folk.png',
    room: 'writing',
    position: { x: 5, y: 12 },
  },
};
```

所有 Agent 共用 `spriteUrl: '/assets/32x32folk.png'`，通过 `spriteKey` 区分帧数据。

- [ ] **Step 5: 提交**

```bash
cd /Users/zero/Project/chat-team
git add frontend/public/assets/32x32folk.png frontend/src/data/spritesheets/ frontend/src/data/agentConfig.ts
git commit -m "feat: add AI Town spritesheet assets and update frame data"
```

---

### Task 2: 扩展 agentStore 增加空间数据

**Files:**
- Modify: `frontend/src/stores/agentStore.ts`
- Modify: `frontend/src/types.ts`
- Test: `frontend/tests/stores/agentStore.test.ts`

- [ ] **Step 1: 在 types.ts 中扩展 AgentAnimationState 和新增类型**

在 `frontend/src/types.ts` 末尾修改：

```typescript
// 修改现有类型，增加 'walking' 选项
export type AgentAnimationState = 'idle' | 'walking' | 'working' | 'thinking';

// 新增方向类型
export type AgentDirection = 'down' | 'up' | 'left' | 'right';
```

`AgentAnimationState` 已包含 `'walking'`，无需改动。新增 `AgentDirection` 类型。

- [ ] **Step 2: 扩展 agentStore 的 AgentVisualState 接口**

在 `frontend/src/stores/agentStore.ts` 中：

```typescript
import { create } from 'zustand';
import type { AgentAnimationState, AgentDirection, WsEvent } from '../types';

interface AgentVisualState {
  animationState: AgentAnimationState;
  thinkingContent: string | null;
  currentTool: string | null;
  outputFiles: string[];
  lastDurationMs: number | null;
  errorMessage: string | null;
  // 新增字段
  direction: AgentDirection;
  targetPosition: { x: number; y: number } | null;
  room: string | null;
}
```

- [ ] **Step 3: 更新 defaultAgentState**

```typescript
const defaultAgentState = (): AgentVisualState => ({
  animationState: 'idle',
  thinkingContent: null,
  currentTool: null,
  outputFiles: [],
  lastDurationMs: null,
  errorMessage: null,
  // 新增默认值
  direction: 'down',
  targetPosition: null,
  room: null,
});
```

- [ ] **Step 4: 写测试 — 验证新字段的初始状态和更新**

在 `frontend/tests/stores/agentStore.test.ts` 末尾追加：

```typescript
it('initializes new spatial fields with defaults', () => {
  useAgentStore.getState().handleEvent({ type: 'agent:thinking', agent_id: 'analyst', content: 'test' });
  const agent = useAgentStore.getState().agents['analyst'];
  expect(agent?.direction).toBe('down');
  expect(agent?.targetPosition).toBeNull();
  expect(agent?.room).toBeNull();
});

it('sets targetPosition and walking state on phase:started event', () => {
  useAgentStore.getState().handleEvent({
    type: 'phase:started',
    phase: 1,
  });
  // phase:started 不带 agent_id，不直接更新 agent store
  // agent 位置变更由 Canvas 层根据 phase 事件自行处理
});

it('resets spatial fields when agent completes', () => {
  // 先设置一些状态
  useAgentStore.setState((state) => ({
    agents: {
      ...state.agents,
      analyst: {
        ...state.agents.analyst ?? defaultAgentState(),
        direction: 'up' as const,
        targetPosition: { x: 10, y: 10 },
        room: 'meeting',
        animationState: 'working' as const,
      },
    },
  }));

  useAgentStore.getState().handleEvent({ type: 'agent:completed', agent_id: 'analyst', duration_ms: 5000 });
  const agent = useAgentStore.getState().agents['analyst'];
  expect(agent?.animationState).toBe('idle');
  expect(agent?.targetPosition).toBeNull();
});
```

注意：需要导入 `defaultAgentState` 或直接构造。由于 `defaultAgentState` 不是 export 的，在测试中改为直接构造对象：

```typescript
it('resets spatial fields when agent completes', () => {
  // 先手动设置带空间数据的 agent
  useAgentStore.setState({
    agents: {
      analyst: {
        animationState: 'working' as const,
        thinkingContent: null,
        currentTool: 'Write',
        outputFiles: [],
        lastDurationMs: null,
        errorMessage: null,
        direction: 'up' as const,
        targetPosition: { x: 10, y: 10 },
        room: 'meeting',
      },
    },
  });

  useAgentStore.getState().handleEvent({ type: 'agent:completed', agent_id: 'analyst', duration_ms: 5000 });
  const agent = useAgentStore.getState().agents['analyst'];
  expect(agent?.animationState).toBe('idle');
  expect(agent?.targetPosition).toBeNull();
});
```

- [ ] **Step 5: 运行测试验证新增测试通过**

```bash
cd /Users/zero/Project/chat-team/frontend && npm run test
```

Expected: 所有测试通过

- [ ] **Step 6: 提交**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/types.ts frontend/src/stores/agentStore.ts frontend/tests/stores/agentStore.test.ts
git commit -m "feat: extend agentStore with spatial data (direction, targetPosition, room)"
```

---

### Task 3: 扩展数据配置（家具、走廊、动画参数）

**Files:**
- Modify: `frontend/src/data/mapConfig.ts`
- Modify: `frontend/src/data/agentConfig.ts`

- [ ] **Step 1: 扩展 mapConfig.ts 添加家具数据**

替换 `frontend/src/data/mapConfig.ts`，为每个房间添加 `floorColor` 和 `furniture` 数组：

```typescript
export interface FurnitureItem {
  type: 'desk' | 'chair' | 'whiteboard' | 'screen' | 'bookshelf' | 'cabinet' | 'lamp';
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
  furniture: FurnitureItem[];
}

export const ROOMS: RoomDef[] = [
  {
    id: 'meeting',
    name: '会议室',
    phase: 1,
    agents: ['analyst'],
    bounds: { x: 0, y: 0, width: 10, height: 8 },
    seats: { analyst: { x: 5, y: 5 } },
    floorColor: 0x3d3530,
    furniture: [
      { type: 'desk', x: 3, y: 3, width: 4, height: 2, color: 0x6b5b47 },
      { type: 'chair', x: 3, y: 2, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 5, y: 2, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 3, y: 5, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 5, y: 5, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 2, y: 3, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 7, y: 4, width: 1, height: 1, color: 0x555566 },
      { type: 'whiteboard', x: 9, y: 2, width: 1, height: 4, color: 0xeeeeee },
      { type: 'screen', x: 4, y: 0, width: 2, height: 1, color: 0x334455 },
    ],
  },
  {
    id: 'design',
    name: '设计中心',
    phase: 2,
    agents: ['architect', 'researcher'],
    bounds: { x: 10, y: 0, width: 10, height: 8 },
    seats: { architect: { x: 13, y: 4 }, researcher: { x: 17, y: 4 } },
    floorColor: 0x303840,
    furniture: [
      { type: 'desk', x: 12, y: 3, width: 3, height: 1, color: 0x6b5b47 },
      { type: 'desk', x: 16, y: 3, width: 3, height: 1, color: 0x6b5b47 },
      { type: 'chair', x: 13, y: 4, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 17, y: 4, width: 1, height: 1, color: 0x555566 },
      { type: 'screen', x: 14, y: 0, width: 3, height: 1, color: 0x334455 },
      { type: 'whiteboard', x: 19, y: 2, width: 1, height: 4, color: 0xeeeeee },
    ],
  },
  {
    id: 'writing',
    name: '撰写区',
    phase: 3,
    agents: ['writer'],
    bounds: { x: 0, y: 8, width: 10, height: 8 },
    seats: { writer: { x: 5, y: 12 } },
    floorColor: 0x2d3a2d,
    furniture: [
      { type: 'desk', x: 4, y: 11, width: 2, height: 1, color: 0x6b5b47 },
      { type: 'chair', x: 5, y: 12, width: 1, height: 1, color: 0x555566 },
      { type: 'bookshelf', x: 0, y: 9, width: 1, height: 6, color: 0x5a4a3a },
      { type: 'lamp', x: 6, y: 11, width: 1, height: 1, color: 0xffdd88 },
    ],
  },
  {
    id: 'archive',
    name: '档案柜',
    phase: null,
    agents: [],
    bounds: { x: 10, y: 8, width: 10, height: 8 },
    seats: {},
    floorColor: 0x383838,
    furniture: [
      { type: 'cabinet', x: 11, y: 9, width: 1, height: 2, color: 0x666655 },
      { type: 'cabinet', x: 11, y: 11, width: 1, height: 2, color: 0x666655 },
      { type: 'cabinet', x: 11, y: 13, width: 1, height: 2, color: 0x666655 },
      { type: 'cabinet', x: 18, y: 9, width: 1, height: 2, color: 0x666655 },
      { type: 'cabinet', x: 18, y: 11, width: 1, height: 2, color: 0x666655 },
      { type: 'whiteboard', x: 13, y: 8, width: 4, height: 1, color: 0xcc9966 },
      { type: 'desk', x: 14, y: 12, width: 2, height: 2, color: 0x6b5b47 },
    ],
  },
];

export const MAP_CONFIG = {
  tileWidth: 32,
  tileHeight: 32,
  mapWidth: 20,
  mapHeight: 16,
  corridorColor: 0x2a2a3a,
  wallColor: 0x1a1a2a,
  wallThickness: 3,
};
```

- [ ] **Step 2: 扩展 agentConfig.ts 添加动画参数**

在接口中新增 `homePosition` 和 `animationSpeed`，更新所有配置对象（见 Task 1 Step 4 已包含 spriteUrl 更新）。

- [ ] **Step 3: 提交**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/data/mapConfig.ts frontend/src/data/agentConfig.ts
git commit -m "feat: extend map and agent configs with furniture and animation params"
```

---

### Task 4: 重写 PixiCanvas 集成 pixi-viewport

**Files:**
- Rewrite: `frontend/src/components/canvas/PixiCanvas.tsx`

架构核心变更：从纯 @pixi/react 声明式切换到半命令式架构。Stage 管理画布，Viewport 命令式创建，子组件通过 Context 获取 viewport。

- [ ] **Step 1: 重写 PixiCanvas.tsx**

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Stage } from '@pixi/react';
import { Viewport } from 'pixi-viewport';
import { Application } from 'pixi.js';
import { MAP_CONFIG } from '../../data/mapConfig';

export const ViewportContext = createContext<Viewport | null>(null);
export const useViewport = () => useContext(ViewportContext);

export function PixiCanvas({ children }: { children?: ReactNode }) {
  const [app, setApp] = useState<Application | null>(null);

  return (
    <>
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        options={{
          backgroundColor: 0x1a1a2e,
          antialias: false,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
        onMount={setApp}
      />
      {app && <ViewportLayer app={app}>{children}</ViewportLayer>}
    </>
  );
}

function ViewportLayer({ app, children }: { app: Application; children?: ReactNode }) {
  const [viewport, setViewport] = useState<Viewport | null>(null);

  useEffect(() => {
    const worldWidth = MAP_CONFIG.mapWidth * MAP_CONFIG.tileWidth;
    const worldHeight = MAP_CONFIG.mapHeight * MAP_CONFIG.tileHeight;

    const vp = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth,
      worldHeight,
      events: app.renderer.events,
    });

    vp.drag()
      .wheel({ smooth: 5 })
      .decelerate({ friction: 0.9 })
      .clamp({ direction: 'all' })
      .clampZoom({
        minWidth: worldWidth / 2,
        minHeight: worldHeight / 2,
        maxWidth: worldWidth * 3,
        maxHeight: worldHeight * 3,
      });

    vp.fitWorld();
    vp.moveCenter(worldWidth / 2, worldHeight / 2);

    app.stage.addChild(vp);
    setViewport(vp);

    const onResize = () => {
      vp.resize(window.innerWidth, window.innerHeight, worldWidth, worldHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      vp.destroy({ children: true });
      if (!app.stage.destroyed) {
        app.stage.removeChild(vp);
      }
    };
  }, [app]);

  return (
    <ViewportContext.Provider value={viewport}>
      {viewport && children}
    </ViewportContext.Provider>
  );
}
```

关键设计：
- `onMount={setApp}` 获取 PixiJS Application
- `ViewportLayer` 创建 pixi-viewport 并管理生命周期
- `ViewportContext` 暴露给子组件，子组件通过 `useViewport()` 获取 viewport 并命令式添加 PixiJS 对象
- 子组件（OfficeMap、AgentSprite 等）返回 `null`，不用 @pixi/react 声明式组件

- [ ] **Step 2: 提交**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/canvas/PixiCanvas.tsx
git commit -m "feat: rewrite PixiCanvas with pixi-viewport integration"
```

---

### Task 5: 重写 OfficeMap 程序化渲染

**Files:**
- Rewrite: `frontend/src/components/canvas/OfficeMap.tsx`

用 PixiJS Graphics API 程序化绘制办公室地图：房间地板（各色）+ 墙壁 + 家具 + 标签 + 点击交互。

- [ ] **Step 1: 重写 OfficeMap.tsx**

```typescript
import { useEffect } from 'react';
import { Graphics, Text, Rectangle } from 'pixi.js';
import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';
import { useViewport } from './PixiCanvas';
import { useUiStore } from '../../stores/uiStore';

export function OfficeMap() {
  const viewport = useViewport();

  useEffect(() => {
    if (!viewport) return;

    const container = new Graphics();
    const labels: Text[] = [];

    // 1. 走廊背景（整个地图）
    container.beginFill(MAP_CONFIG.corridorColor);
    container.drawRect(0, 0, MAP_CONFIG.mapWidth * MAP_CONFIG.tileWidth, MAP_CONFIG.mapHeight * MAP_CONFIG.tileHeight);
    container.endFill();

    // 2. 房间地板 + 墙壁 + 家具
    for (const room of ROOMS) {
      const { x, y, width, height } = room.bounds;
      const px = x * MAP_CONFIG.tileWidth;
      const py = y * MAP_CONFIG.tileHeight;
      const pw = width * MAP_CONFIG.tileWidth;
      const ph = height * MAP_CONFIG.tileHeight;

      // 地板
      container.beginFill(room.floorColor);
      container.drawRect(px, py, pw, ph);
      container.endFill();

      // 墙壁
      container.lineStyle(MAP_CONFIG.wallThickness, MAP_CONFIG.wallColor, 1);
      container.drawRect(px, py, pw, ph);
      container.lineStyle(0);

      // 家具
      for (const item of room.furniture) {
        drawFurniture(container, item);
      }

      // 标签
      const label = new Text(room.name, {
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0x888899,
        align: 'center',
      });
      label.anchor.set(0.5);
      label.x = (x + width / 2) * MAP_CONFIG.tileWidth;
      label.y = (y + 0.8) * MAP_CONFIG.tileHeight;
      labels.push(label);
    }

    viewport.addChild(container);
    labels.forEach((l) => viewport.addChild(l));

    // 3. 档案柜点击交互
    const archiveRoom = ROOMS.find((r) => r.id === 'archive')!;
    const hitArea = new Rectangle(
      archiveRoom.bounds.x * MAP_CONFIG.tileWidth,
      archiveRoom.bounds.y * MAP_CONFIG.tileHeight,
      archiveRoom.bounds.width * MAP_CONFIG.tileWidth,
      archiveRoom.bounds.height * MAP_CONFIG.tileHeight,
    );

    const interactiveLayer = new Graphics();
    interactiveLayer.beginFill(0xffffff, 0.001);
    interactiveLayer.drawRect(
      archiveRoom.bounds.x * MAP_CONFIG.tileWidth,
      archiveRoom.bounds.y * MAP_CONFIG.tileHeight,
      archiveRoom.bounds.width * MAP_CONFIG.tileWidth,
      archiveRoom.bounds.height * MAP_CONFIG.tileHeight,
    );
    interactiveLayer.endFill();
    interactiveLayer.hitArea = hitArea;
    interactiveLayer.eventMode = 'static';
    interactiveLayer.cursor = 'pointer';

    const openArchive = useUiStore.getState().openArchiveDrawer;
    interactiveLayer.on('pointerdown', openArchive);

    viewport.addChild(interactiveLayer);

    return () => {
      viewport.removeChild(container);
      labels.forEach((l) => { viewport.removeChild(l); l.destroy(); });
      viewport.removeChild(interactiveLayer);
      container.destroy({ children: true });
      interactiveLayer.destroy({ children: true });
    };
  }, [viewport]);

  return null;
}

function drawFurniture(g: Graphics, item: typeof ROOMS[number]['furniture'][number]) {
  const x = item.x * MAP_CONFIG.tileWidth;
  const y = item.y * MAP_CONFIG.tileHeight;
  const w = item.width * MAP_CONFIG.tileWidth;
  const h = item.height * MAP_CONFIG.tileHeight;

  g.beginFill(item.color);

  switch (item.type) {
    case 'desk':
      g.drawRoundedRect(x + 2, y + 2, w - 4, h - 4, 2);
      break;
    case 'chair':
      g.drawCircle(x + w / 2, y + h / 2, Math.min(w, h) / 2 - 4);
      break;
    case 'whiteboard':
      g.drawRect(x, y, w, h);
      g.beginFill(0xdddddd, 0.5);
      g.drawRect(x + 2, y + 2, w - 4, h - 4);
      break;
    case 'screen':
      g.drawRect(x, y, w, h);
      // 屏幕反光效果
      g.beginFill(0x5588aa, 0.3);
      g.drawRect(x + 2, y + 2, w - 4, h - 4);
      break;
    case 'bookshelf':
      g.drawRect(x, y, w, h);
      // 书架横线
      g.lineStyle(1, 0x443322, 0.5);
      for (let i = 1; i < Math.floor(h / 16); i++) {
        g.moveTo(x, y + i * 16);
        g.lineTo(x + w, y + i * 16);
      }
      g.lineStyle(0);
      break;
    case 'cabinet':
      g.drawRect(x + 1, y + 1, w - 2, h - 2);
      // 柜子把手
      g.beginFill(0x999988);
      g.drawCircle(x + w / 2, y + h / 2, 2);
      break;
    case 'lamp':
      // 灯光晕
      g.drawCircle(x + w / 2, y + h / 2, Math.min(w, h) / 2);
      g.beginFill(item.color, 0.15);
      g.drawCircle(x + w / 2, y + h / 2, Math.min(w, h));
      break;
    default:
      g.drawRect(x, y, w, h);
  }

  g.endFill();
}
```

- [ ] **Step 2: 提交**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/canvas/OfficeMap.tsx
git commit -m "feat: rewrite OfficeMap with programmatic furniture rendering"
```

---

### Task 6: 重写 AgentSprite 精灵动画

**Files:**
- Rewrite: `frontend/src/components/canvas/AgentSprite.tsx`

这是最复杂的组件。加载 spritesheet → AnimatedSprite → 帧动画状态机 → lerp 移动 → 点击交互。

- [ ] **Step 1: 重写 AgentSprite.tsx**

```typescript
import { useEffect, useRef } from 'react';
import { Container, Spritesheet, AnimatedSprite, Graphics, Text } from 'pixi.js';
import { AGENT_CONFIGS } from '../../data/agentConfig';
import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';
import { useViewport } from './PixiCanvas';
import { useAgentStore } from '../../stores/agentStore';
import { useUiStore } from '../../stores/uiStore';
import type { AgentAnimationState, AgentDirection } from '../../types';
import { spritesheetData as f1Data } from '../../data/spritesheets/f1';
import { spritesheetData as f3Data } from '../../data/spritesheets/f3';
import { spritesheetData as f4Data } from '../../data/spritesheets/f4';
import { spritesheetData as f6Data } from '../../data/spritesheets/f6';

const SPRITESHEET_MAP: Record<string, typeof f1Data> = {
  f1: f1Data,
  f3: f3Data,
  f4: f4Data,
  f6: f6Data,
};

const AGENT_NAMES: Record<string, string> = {
  analyst: '需求分析师',
  architect: '方案架构师',
  researcher: '资料研究员',
  writer: '方案撰写员',
};

// 缓存已加载的 spritesheet
const spritesheetCache = new Map<string, Spritesheet>();

async function loadSpritesheet(spriteKey: string): Promise<Spritesheet> {
  if (spritesheetCache.has(spriteKey)) return spritesheetCache.get(spriteKey)!;

  const data = SPRITESHEET_MAP[spriteKey];
  if (!data) throw new Error(`No spritesheet data for key: ${spriteKey}`);

  const sheet = new Spritesheet(data.meta.image!, data);
  await sheet.parse();
  spritesheetCache.set(spriteKey, sheet);
  return sheet;
}

function getDirection(from: { x: number; y: number }, to: { x: number; y: number }): AgentDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export function AllAgentSprites() {
  const agentIds = Object.keys(AGENT_CONFIGS);
  return <>{agentIds.map((id) => <AgentSprite key={id} agentId={id} />)}</>;
}

export function AgentSprite({ agentId }: { agentId: string }) {
  const viewport = useViewport();
  const containerRef = useRef<Container | null>(null);
  const spriteRef = useRef<AnimatedSprite | null>(null);
  const labelRef = useRef<Text | null>(null);
  const bubbleRef = useRef<Graphics | null>(null);
  const currentAnimRef = useRef<AgentAnimationState>('idle');
  const currentDirRef = useRef<AgentDirection>('down');
  const moveAnimRef = useRef<{ from: { x: number; y: number }; to: { x: number; y: number }; progress: number } | null>(null);

  const config = AGENT_CONFIGS[agentId];
  const room = ROOMS.find((r) => r.agents.includes(agentId));
  const seat = room?.seats[agentId] ?? config.position;

  useEffect(() => {
    if (!viewport) return;

    const container = new Container();
    containerRef.current = container;

    let destroyed = false;

    // 加载精灵图
    loadSpritesheet(config.spriteKey).then((sheet) => {
      if (destroyed) return;

      const textures = sheet.animations['down'];
      if (!textures || textures.length === 0) return;

      const sprite = new AnimatedSprite(textures);
      sprite.anchor.set(0.5);
      sprite.scale.set(1); // 32x32 已是合适大小
      sprite.animationSpeed = config.animationSpeed.idle;
      sprite.play();
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';

      // 点击打开 Agent 详情
      sprite.on('pointerdown', () => {
        useUiStore.getState().openAgentDetail(agentId);
      });

      // 初始位置
      const startX = seat.x * MAP_CONFIG.tileWidth;
      const startY = seat.y * MAP_CONFIG.tileHeight;
      sprite.x = startX;
      sprite.y = startY;
      spriteRef.current = sprite;
      container.addChild(sprite);

      // 名称标签
      const label = new Text(AGENT_NAMES[agentId] ?? agentId, {
        fontFamily: 'sans-serif',
        fontSize: 10,
        fill: 0xcccccc,
        align: 'center',
      });
      label.anchor.set(0.5);
      label.x = startX;
      label.y = startY + 22;
      labelRef.current = label;
      container.addChild(label);
    });

    viewport.addChild(container);

    // Ticker 驱动移动动画
    const ticker = viewport.children; // 用 app ticker
    const onTick = () => {
      const move = moveAnimRef.current;
      if (!move) return;

      move.progress += 0.03; // ~3 tiles/sec at 60fps
      if (move.progress >= 1) {
        move.progress = 1;
        moveAnimRef.current = null;
      }

      const x = move.from.x + (move.to.x - move.from.x) * move.progress;
      const y = move.from.y + (move.to.y - move.from.y) * move.progress;

      if (spriteRef.current) {
        spriteRef.current.x = x;
        spriteRef.current.y = y;
      }
      if (labelRef.current) {
        labelRef.current.x = x;
        labelRef.current.y = y + 22;
      }
      if (bubbleRef.current) {
        bubbleRef.current.x = x;
        bubbleRef.current.y = y - 28;
      }
    };

    const app = (viewport as any)._tickerAdd;
    // 使用 requestAnimationFrame 代替 app ticker
    let rafId: number;
    const tickLoop = () => {
      onTick();
      rafId = requestAnimationFrame(tickLoop);
    };
    rafId = requestAnimationFrame(tickLoop);

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      viewport.removeChild(container);
      container.destroy({ children: true });
      spriteRef.current = null;
      labelRef.current = null;
      bubbleRef.current = null;
      containerRef.current = null;
    };
  }, [viewport, config.spriteKey, agentId, seat.x, seat.y]);

  // 订阅 store 变化，更新动画
  useEffect(() => {
    const unsubscribe = useAgentStore.subscribe((state) => {
      const agent = state.agents[agentId];
      if (!agent || !spriteRef.current) return;

      // 更新动画状态
      if (agent.animationState !== currentAnimRef.current) {
        currentAnimRef.current = agent.animationState;
        updateAnimation(spriteRef.current, agent.animationState, currentDirRef.current, config);
      }

      // 更新思考气泡
      updateBubble(containerRef.current, bubbleRef, agent.animationState, agent.thinkingContent);

      // 处理移动
      if (agent.targetPosition && spriteRef.current) {
        const from = { x: spriteRef.current.x, y: spriteRef.current.y };
        const to = {
          x: agent.targetPosition.x * MAP_CONFIG.tileWidth,
          y: agent.targetPosition.y * MAP_CONFIG.tileHeight,
        };
        moveAnimRef.current = { from, to, progress: 0 };
        currentDirRef.current = getDirection(
          { x: from.x / MAP_CONFIG.tileWidth, y: from.y / MAP_CONFIG.tileHeight },
          agent.targetPosition,
        );
        updateAnimation(spriteRef.current, 'walking', currentDirRef.current, config);
      }
    });

    return unsubscribe;
  }, [agentId, config]);

  return null;
}

function updateAnimation(
  sprite: AnimatedSprite,
  state: AgentAnimationState,
  direction: AgentDirection,
  config: typeof AGENT_CONFIGS[string],
) {
  const dirKey = direction;
  const textures = sprite.textures;

  // 如果有对应方向的动画帧
  if (sprite.totalFrames > 0) {
    // AnimatedSprite 的 animations 来自 spritesheet
    // 这里需要切换 textures
    // 简化处理：直接用当前 textures，调整速度
  }

  switch (state) {
    case 'idle':
      sprite.animationSpeed = config.animationSpeed.idle;
      sprite.loop = true;
      break;
    case 'walking':
      sprite.animationSpeed = config.animationSpeed.walking;
      sprite.loop = true;
      break;
    case 'working':
      sprite.animationSpeed = config.animationSpeed.working;
      sprite.loop = true;
      break;
    case 'thinking':
      sprite.animationSpeed = config.animationSpeed.thinking;
      sprite.loop = true;
      break;
  }

  if (!sprite.playing) sprite.play();
}

function updateBubble(
  container: Container | null,
  bubbleRef: React.MutableRefObject<Graphics | null>,
  state: AgentAnimationState,
  content: string | null,
) {
  if (!container) return;

  // 移除旧气泡
  if (bubbleRef.current) {
    container.removeChild(bubbleRef.current);
    bubbleRef.current.destroy({ children: true });
    bubbleRef.current = null;
  }

  if (state !== 'thinking' || !content) return;

  // 创建新气泡
  const bubble = new Graphics();
  const displayText = content.length > 50 ? content.slice(0, 50) + '...' : content;

  bubble.beginFill(0xffffff, 0.9);
  bubble.drawRoundedRect(-60, -16, 120, 24, 8);
  bubble.endFill();

  // 尾巴
  bubble.beginFill(0xffffff, 0.9);
  bubble.drawPolygon([0, 8, -5, -2, 5, -2]);
  bubble.endFill();

  const text = new Text(displayText, {
    fontFamily: 'sans-serif',
    fontSize: 9,
    fill: 0x333333,
    wordWrap: true,
    wordWrapWidth: 110,
  });
  text.anchor.set(0.5);
  text.x = 0;
  text.y = -4;
  bubble.addChild(text);

  bubbleRef.current = bubble;
  container.addChild(bubble);
}
```

注意：`updateAnimation` 中的方向切换需要根据实际 spritesheet 的 animations 结构来实现。AI Town 的 spritesheet 格式定义了 `down`、`up`、`left`、`right` 四个动画序列。加载后可通过 `sheet.animations['down']` 等获取各方向的帧纹理。完整的方向切换逻辑需要在实际集成时根据 spritesheet 解析结果微调。

- [ ] **Step 2: 提交**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/canvas/AgentSprite.tsx
git commit -m "feat: rewrite AgentSprite with spritesheet animation and lerp movement"
```

---

### Task 7: 新增 FlyingDocument 飞行动画

**Files:**
- Create: `frontend/src/components/canvas/FlyingDocument.tsx`

agent:output 事件触发时，文件图标从 Agent 飞向档案柜区域，抛物线轨迹。

- [ ] **Step 1: 创建 FlyingDocument.tsx**

```typescript
import { useEffect, useRef } from 'react';
import { Graphics } from 'pixi.js';
import { useViewport } from './PixiCanvas';
import { useAgentStore } from '../../stores/agentStore';
import { AGENT_CONFIGS, AGENT_CONFIGS as CONFIGS } from '../../data/agentConfig';
import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';

const ARCHIVE_CENTER = (() => {
  const archive = ROOMS.find((r) => r.id === 'archive')!;
  return {
    x: (archive.bounds.x + archive.bounds.width / 2) * MAP_CONFIG.tileWidth,
    y: (archive.bounds.y + archive.bounds.height / 2) * MAP_CONFIG.tileHeight,
  };
})();

interface FlyingDoc {
  graphic: Graphics;
  startTime: number;
  duration: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function FlyingDocument() {
  const viewport = useViewport();
  const docsRef = useRef<FlyingDoc[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!viewport) return;

    // 订阅 store 变化，检测新增 output 文件
    const unsubscribe = useAgentStore.subscribe((state, prevState) => {
      for (const agentId of Object.keys(state.agents)) {
        const prev = prevState.agents[agentId];
        const curr = state.agents[agentId];
        if (!curr || !prev) continue;

        if (curr.outputFiles.length > prev.outputFiles.length) {
          // 新增了 output 文件，触发飞行动画
          const config = CONFIGS[agentId];
          const room = ROOMS.find((r) => r.agents.includes(agentId));
          const seat = room?.seats[agentId] ?? config.position;

          const from = {
            x: seat.x * MAP_CONFIG.tileWidth,
            y: seat.y * MAP_CONFIG.tileHeight,
          };

          const graphic = new Graphics();
          // 文件图标：白色矩形 + 折角
          graphic.beginFill(0xffeedd);
          graphic.drawRect(-8, -10, 16, 20);
          graphic.endFill();
          graphic.beginFill(0xddccbb);
          graphic.drawPolygon([0, -10, 8, -10, 8, -2]);
          graphic.endFill();
          graphic.beginFill(0xccbbaa);
          graphic.drawPolygon([0, -10, 8, -2, 0, -2]);
          graphic.endFill();
          // 文字线条
          graphic.lineStyle(1, 0x999999);
          graphic.moveTo(-5, -4); graphic.lineTo(5, -4);
          graphic.moveTo(-5, 0); graphic.lineTo(5, 0);
          graphic.moveTo(-5, 4); graphic.lineTo(2, 4);
          graphic.lineStyle(0);

          viewport.addChild(graphic);

          docsRef.current.push({
            graphic,
            startTime: performance.now(),
            duration: 800,
            from,
            to: { x: ARCHIVE_CENTER.x + (Math.random() - 0.5) * 40, y: ARCHIVE_CENTER.y + (Math.random() - 0.5) * 40 },
          });
        }
      }
    });

    // 动画循环
    const tick = () => {
      const now = performance.now();
      docsRef.current = docsRef.current.filter((doc) => {
        const t = (now - doc.startTime) / doc.duration;
        if (t >= 1) {
          doc.graphic.destroy();
          viewport.removeChild(doc.graphic);
          return false;
        }

        // 二次贝塞尔曲线（抛物线）
        const x = doc.from.x + (doc.to.x - doc.from.x) * t;
        const peakY = Math.min(doc.from.y, doc.to.y) - 80;
        const y = (1 - t) * (1 - t) * doc.from.y + 2 * (1 - t) * t * peakY + t * t * doc.to.y;

        doc.graphic.x = x;
        doc.graphic.y = y;
        doc.graphic.alpha = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;

        return true;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      unsubscribe();
      docsRef.current.forEach((doc) => {
        doc.graphic.destroy();
        if (!viewport.destroyed) viewport.removeChild(doc.graphic);
      });
      docsRef.current = [];
    };
  }, [viewport]);

  return null;
}
```

- [ ] **Step 2: 提交**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/canvas/FlyingDocument.tsx
git commit -m "feat: add FlyingDocument animation component"
```

---

### Task 8: 集成所有组件 + Celebration 特效

**Files:**
- Modify: `frontend/src/App.tsx`

将所有新组件整合到 App.tsx，并添加 session 完成时的庆祝粒子效果。

- [ ] **Step 1: 更新 App.tsx**

```typescript
import { PixiCanvas } from './components/canvas/PixiCanvas';
import { OfficeMap } from './components/canvas/OfficeMap';
import { AllAgentSprites } from './components/canvas/AgentSprite';
import { FlyingDocument } from './components/canvas/FlyingDocument';
import { NewTaskModal } from './components/overlay/NewTaskModal';
import { StatusBar } from './components/overlay/StatusBar';
import { AgentDetailPanel } from './components/overlay/AgentDetailPanel';
import { DocViewer } from './components/overlay/DocViewer';
import { ArchiveDrawer } from './components/overlay/ArchiveDrawer';
import { useWebSocket } from './hooks/useWebSocket';
import { useSessionStore } from './stores/sessionStore';

function GameScene() {
  return (
    <PixiCanvas>
      <OfficeMap />
      <AllAgentSprites />
      <FlyingDocument />
      <CelebrationEffect />
    </PixiCanvas>
  );
}

export default function App() {
  const activeSessionId = useSessionStore((s) => s.activeSession?.id ?? null);
  useWebSocket(activeSessionId);

  return (
    <div className="w-full h-full relative">
      <GameScene />
      <NewTaskModal />
      <StatusBar />
      <AgentDetailPanel />
      <DocViewer />
      <ArchiveDrawer />
    </div>
  );
}
```

- [ ] **Step 2: 在同一文件或新建 CelebrationEffect 组件**

在 `frontend/src/components/canvas/CelebrationEffect.tsx`：

```typescript
import { useEffect, useRef } from 'react';
import { Graphics } from 'pixi.js';
import { useViewport } from './PixiCanvas';
import { useSessionStore } from '../../stores/sessionStore';

const CONFETTI_COLORS = [0x53c28b, 0x7eb8da, 0xf0a500, 0xc89bda, 0xff6b6b, 0x88ccff];

interface Particle {
  graphic: Graphics;
  vx: number;
  vy: number;
  life: number;
}

export function CelebrationEffect() {
  const viewport = useViewport();
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!viewport) return;

    const unsubscribe = useSessionStore.subscribe((state, prevState) => {
      const activeId = state.activeSession?.id;
      if (!activeId) return;

      const prevStatus = prevState.sessions.find((s) => s.id === activeId)?.status;
      const currStatus = state.sessions.find((s) => s.id === activeId)?.status;

      if (prevStatus !== 'completed' && currStatus === 'completed') {
        spawnConfetti();
      }
    });

    const spawnConfetti = () => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      for (let i = 0; i < 40; i++) {
        const graphic = new Graphics();
        const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        const size = 4 + Math.random() * 6;

        graphic.beginFill(color);
        graphic.drawRect(-size / 2, -size / 2, size, size * 0.6);
        graphic.endFill();
        graphic.x = cx;
        graphic.y = cy;
        graphic.rotation = Math.random() * Math.PI * 2;

        viewport.addChild(graphic);

        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;

        particlesRef.current.push({
          graphic,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          life: 120, // ~2 seconds at 60fps
        });
      }
    };

    const tick = () => {
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life--;
        if (p.life <= 0) {
          p.graphic.destroy();
          if (!viewport.destroyed) viewport.removeChild(p.graphic);
          return false;
        }

        p.vy += 0.15; // gravity
        p.graphic.x += p.vx;
        p.graphic.y += p.vy;
        p.graphic.rotation += 0.1;
        p.graphic.alpha = Math.min(1, p.life / 30);

        return true;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      unsubscribe();
      particlesRef.current.forEach((p) => {
        p.graphic.destroy();
        if (!viewport.destroyed) viewport.removeChild(p.graphic);
      });
      particlesRef.current = [];
    };
  }, [viewport]);

  return null;
}
```

- [ ] **Step 3: 运行类型检查**

```bash
cd /Users/zero/Project/chat-team/frontend && npx tsc --noEmit
```

Expected: 无类型错误。修复任何编译问题。

- [ ] **Step 4: 运行全部测试**

```bash
cd /Users/zero/Project/chat-team/frontend && npm run test
```

Expected: 所有测试通过。

- [ ] **Step 5: 启动开发服务器并视觉验证**

```bash
cd /Users/zero/Project/chat-team/frontend && npm run dev
```

在浏览器 http://localhost:3000 验证：
- [ ] 办公室地图可见，4 个房间各有不同色调
- [ ] 家具细节可见（桌子、椅子、白板等）
- [ ] 4 个角色精灵可见（来自 AI Town spritesheet）
- [ ] 鼠标拖拽可平移地图
- [ ] 滚轮可缩放地图
- [ ] 松手后惯性滑动

- [ ] **Step 6: 提交**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/App.tsx frontend/src/components/canvas/CelebrationEffect.tsx
git commit -m "feat: integrate all canvas components and add celebration effect"
```

---

### Task 9: 最终修复和验证

**Files:**
- Potentially any canvas component based on visual testing

- [ ] **Step 1: 修复 spritesheet 加载和方向切换**

Task 6 中的 `updateAnimation` 函数需要根据实际 spritesheet 解析结果完善方向切换逻辑。启动开发服务器后，检查角色是否正确显示、动画是否流畅。关键点：
- `sheet.animations` 解析后应包含 `down`、`up`、`left`、`right` 四组纹理
- 切换方向时需要 `sprite.textures = sheet.animations[direction]`
- 确保 `AnimatedSprite` 的 textures 属性可正确更新

- [ ] **Step 2: 调整 moveAnimRef 的 lerp 速度**

在 AgentSprite 中，移动速度由 `move.progress += 0.03` 控制。如果移动太快或太慢，调整这个值。设计目标每秒 3 瓦片。

- [ ] **Step 3: 确保前端 build 无错误**

```bash
cd /Users/zero/Project/chat-team/frontend && npm run build
```

Expected: 构建成功

- [ ] **Step 4: 最终提交**

```bash
cd /Users/zero/Project/chat-team
git add -A
git commit -m "fix: refine spritesheet animation and movement parameters"
```
