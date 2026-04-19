# Tiled 办公室地图渲染 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 OfficeMap 的 Graphics 原语渲染替换为基于 Tiled 编辑器的瓦片地图渲染，复用斯坦福小镇的 Cute RPG 室内素材。

**Architecture:** 在 PixiJS 中集成 @pixi/tilemap 插件加载 Tiled 导出的 JSON 地图。新增 tmxLoader 解析器将 Tiled JSON 转为 PixiJS 可用的瓦片纹理数据，新增 TiledMap 组件替代现有 OfficeMap 组件。

**Tech Stack:** PixiJS 7.4, @pixi/tilemap, TypeScript, Vitest

---

## File Structure

```
新增:
  frontend/src/utils/tmxLoader.ts          — Tiled JSON 解析器
  frontend/src/components/canvas/TiledMap.tsx — 瓦片地图渲染组件（替代 OfficeMap）
  frontend/public/assets/tilesets/*.png     — 素材文件
  frontend/public/assets/maps/the_office.json — Tiled 地图数据
  frontend/tests/utils/tmxLoader.test.ts   — 解析器测试

修改:
  frontend/src/App.tsx                      — OfficeMap → TiledMap
  frontend/src/components/canvas/PixiCanvas.tsx — 从 tmxLoader 获取地图尺寸
  frontend/src/data/mapConfig.ts            — 精简为仅保留运行时数据

删除:
  frontend/src/components/canvas/OfficeMap.tsx — 被 TiledMap 完全替代
```

---

### Task 1: 复制素材文件

**Files:**
- Create: `frontend/public/assets/tilesets/Room_Builder_32x32.png`
- Create: `frontend/public/assets/tilesets/interiors_pt1.png`
- Create: `frontend/public/assets/tilesets/interiors_pt2.png`
- Create: `frontend/public/assets/tilesets/interiors_pt3.png`
- Create: `frontend/public/assets/tilesets/interiors_pt4.png`
- Create: `frontend/public/assets/tilesets/interiors_pt5.png`
- Create: `frontend/public/assets/tilesets/blocks_1.png`

- [ ] **Step 1: 创建目标目录并复制文件**

```bash
mkdir -p D:/code/chat-team/frontend/public/assets/tilesets
mkdir -p D:/code/chat-team/frontend/public/assets/maps

cp "D:/code/generative_agents/environment/frontend_server/static_dirs/assets/the_ville/visuals/map_assets/v1/Room_Builder_32x32.png" \
   D:/code/chat-team/frontend/public/assets/tilesets/

for i in 1 2 3 4 5; do
  cp "D:/code/generative_agents/environment/frontend_server/static_dirs/assets/the_ville/visuals/map_assets/v1/interiors_pt${i}.png" \
     D:/code/chat-team/frontend/public/assets/tilesets/
done

cp "D:/code/generative_agents/environment/frontend_server/static_dirs/assets/the_ville/visuals/map_assets/blocks/blocks_1.png" \
   D:/code/chat-team/frontend/public/assets/tilesets/
```

- [ ] **Step 2: 验证文件已复制**

Run: `ls -la D:/code/chat-team/frontend/public/assets/tilesets/`
Expected: 7 个 PNG 文件

- [ ] **Step 3: Commit**

```bash
cd D:/code/chat-team
git add frontend/public/assets/tilesets/
git commit -m "chore: add Cute RPG tileset assets from generative_agents"
```

---

### Task 2: 安装 @pixi/tilemap 依赖

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: 安装依赖**

Run: `cd D:/code/chat-team/frontend && npm install @pixi/tilemap@^7.0.0`

- [ ] **Step 2: 验证安装成功**

Run: `cd D:/code/chat-team/frontend && npm ls @pixi/tilemap`
Expected: `@pixi/tilemap@7.x.x`

- [ ] **Step 3: Commit**

```bash
cd D:/code/chat-team
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add @pixi/tilemap dependency"
```

---

### Task 3: 实现 tmxLoader 解析器

**Files:**
- Create: `frontend/src/utils/tmxLoader.ts`
- Test: `frontend/tests/utils/tmxLoader.test.ts`

- [ ] **Step 1: 写 tmxLoader 测试**

```typescript
// frontend/tests/utils/tmxLoader.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseTiledMap,
  resolveTileSourceRect,
  parseInteractables,
  type TiledMapData,
  type TiledTileset,
  type TiledLayer,
} from '../../src/utils/tmxLoader';

// 最小 mock 地图数据，模拟 Tiled JSON 导出格式
function makeMockMap(overrides?: Partial<TiledMapData>): TiledMapData {
  return {
    width: 4,
    height: 3,
    tileWidth: 32,
    tileHeight: 32,
    tilesets: [
      {
        firstgid: 1,
        name: 'walls',
        tileWidth: 32,
        tileHeight: 32,
        columns: 4,
        image: 'tilesets/Room_Builder_32x32.png',
        imageWidth: 128,
        imageHeight: 128,
      },
    ],
    layers: [
      {
        name: 'Floor',
        type: 'tilelayer',
        data: [
          1, 1, 1, 1,
          1, 2, 2, 1,
          1, 1, 1, 1,
        ],
        visible: true,
        opacity: 1,
      },
    ],
    ...overrides,
  };
}

describe('parseTiledMap', () => {
  it('parses a valid Tiled JSON object', () => {
    const json = {
      width: 4,
      height: 3,
      tilewidth: 32,
      tileheight: 32,
      layers: [
        {
          name: 'Floor',
          type: 'tilelayer',
          data: [1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1],
          visible: true,
          opacity: 1,
        },
      ],
      tilesets: [
        {
          firstgid: 1,
          name: 'walls',
          tilewidth: 32,
          tileheight: 32,
          columns: 4,
          image: 'tilesets/walls.png',
          imagewidth: 128,
          imageheight: 128,
        },
      ],
    };

    const result = parseTiledMap(json);

    expect(result.width).toBe(4);
    expect(result.height).toBe(3);
    expect(result.tileWidth).toBe(32);
    expect(result.tileHeight).toBe(32);
    expect(result.tilesets).toHaveLength(1);
    expect(result.tilesets[0].name).toBe('walls');
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].name).toBe('Floor');
    expect(result.layers[0].data).toEqual([1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1]);
  });

  it('handles objectgroup layers', () => {
    const json = {
      width: 4,
      height: 3,
      tilewidth: 32,
      tileheight: 32,
      layers: [
        {
          name: 'Interactables',
          type: 'objectgroup',
          objects: [
            { id: 1, name: 'task_table', type: 'task', x: 96, y: 64, width: 96, height: 96, properties: { roomId: 'rd' } },
          ],
          visible: true,
          opacity: 1,
        },
      ],
      tilesets: [],
    };

    const result = parseTiledMap(json);
    expect(result.layers[0].type).toBe('objectgroup');
    expect(result.layers[0].objects).toHaveLength(1);
    expect(result.layers[0].objects![0].type).toBe('task');
  });
});

describe('resolveTileSourceRect', () => {
  it('calculates correct source rect for a tile in the first tileset', () => {
    const tileset: TiledTileset = {
      firstgid: 1,
      name: 'walls',
      tileWidth: 32,
      tileHeight: 32,
      columns: 4,
      image: 'tilesets/walls.png',
      imageWidth: 128,
      imageHeight: 128,
    };

    // GID 5 = 4th tileset offset: firstgid=1, local id = 5-1 = 4
    // column = 4 % 4 = 0, row = floor(4/4) = 1 → x=0, y=32
    const rect = resolveTileSourceRect(tileset, 5);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(32);
    expect(rect.width).toBe(32);
    expect(rect.height).toBe(32);
  });

  it('calculates correct rect for tile at column 2 row 0', () => {
    const tileset: TiledTileset = {
      firstgid: 1,
      name: 'walls',
      tileWidth: 32,
      tileHeight: 32,
      columns: 4,
      image: 'tilesets/walls.png',
      imageWidth: 128,
      imageHeight: 128,
    };

    // GID 3 → local id = 2, column = 2 % 4 = 2, row = 0 → x=64, y=0
    const rect = resolveTileSourceRect(tileset, 3);
    expect(rect.x).toBe(64);
    expect(rect.y).toBe(0);
  });

  it('calculates correct rect for second tileset with firstgid > 1', () => {
    const tileset: TiledTileset = {
      firstgid: 100,
      name: 'interiors',
      tileWidth: 32,
      tileHeight: 32,
      columns: 16,
      image: 'tilesets/interiors.png',
      imageWidth: 512,
      imageHeight: 512,
    };

    // GID 103 → local id = 3, column = 3 % 16 = 3, row = 0 → x=96, y=0
    const rect = resolveTileSourceRect(tileset, 103);
    expect(rect.x).toBe(96);
    expect(rect.y).toBe(0);
  });
});

describe('parseInteractables', () => {
  it('extracts interaction zones from objectgroup layer', () => {
    const layer: TiledLayer = {
      name: 'Interactables',
      type: 'objectgroup',
      objects: [
        { id: 1, name: 'round_table', type: 'task', x: 320, y: 128, width: 96, height: 96, properties: { roomId: 'rd' } },
        { id: 2, name: 'cabinet', type: 'archive', x: 224, y: 0, width: 64, height: 64, properties: { roomId: 'rd' } },
      ],
      visible: true,
      opacity: 1,
    };

    const zones = parseInteractables(layer);

    expect(zones).toHaveLength(2);
    expect(zones[0]).toEqual({
      name: 'round_table',
      type: 'task',
      x: 320,
      y: 128,
      width: 96,
      height: 96,
      roomId: 'rd',
    });
    expect(zones[1].type).toBe('archive');
  });

  it('returns empty array for tilelayer', () => {
    const layer: TiledLayer = {
      name: 'Floor',
      type: 'tilelayer',
      data: [1, 2, 3],
      visible: true,
      opacity: 1,
    };

    expect(parseInteractables(layer)).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd D:/code/chat-team/frontend && npx vitest run tests/utils/tmxLoader.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 tmxLoader**

```typescript
// frontend/src/utils/tmxLoader.ts
import { Rectangle } from '@pixi/math';

// ---------------------------------------------------------------------------
// Types — match Tiled JSON export format
// ---------------------------------------------------------------------------

export interface TiledTileset {
  firstgid: number;
  name: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  image: string;
  imageWidth: number;
  imageHeight: number;
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: Record<string, any>;
}

export interface TiledLayer {
  name: string;
  type: 'tilelayer' | 'objectgroup';
  data?: number[];
  objects?: TiledObject[];
  visible: boolean;
  opacity: number;
  properties?: Record<string, any>;
}

export interface TiledMapData {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tilesets: TiledTileset[];
  layers: TiledLayer[];
}

export interface InteractionZone {
  name: string;
  type: string; // 'task' | 'archive' | 'agent_seat'
  x: number;
  y: number;
  width: number;
  height: number;
  roomId: string;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseTiledMap(json: any): TiledMapData {
  return {
    width: json.width,
    height: json.height,
    tileWidth: json.tilewidth,
    tileHeight: json.tileheight,
    tilesets: (json.tilesets ?? []).map((ts: any) => ({
      firstgid: ts.firstgid,
      name: ts.name,
      tileWidth: ts.tilewidth,
      tileHeight: ts.tileheight,
      columns: ts.columns,
      image: ts.image,
      imageWidth: ts.imagewidth,
      imageHeight: ts.imageheight,
    })),
    layers: (json.layers ?? []).map((l: any) => ({
      name: l.name,
      type: l.type,
      data: l.data,
      objects: l.objects,
      visible: l.visible ?? true,
      opacity: l.opacity ?? 1,
      properties: l.properties,
    })),
  };
}

export async function loadTiledMap(jsonPath: string): Promise<TiledMapData> {
  const resp = await fetch(jsonPath);
  if (!resp.ok) throw new Error(`Failed to load map: ${resp.status}`);
  const json = await resp.json();
  return parseTiledMap(json);
}

export function resolveTileSourceRect(
  tileset: TiledTileset,
  gid: number,
): Rectangle {
  const localId = gid - tileset.firstgid;
  const col = localId % tileset.columns;
  const row = Math.floor(localId / tileset.columns);
  return new Rectangle(
    col * tileset.tileWidth,
    row * tileset.tileHeight,
    tileset.tileWidth,
    tileset.tileHeight,
  );
}

export function findTilesetForGid(
  tilesets: TiledTileset[],
  gid: number,
): TiledTileset | null {
  for (let i = tilesets.length - 1; i >= 0; i--) {
    if (gid >= tilesets[i].firstgid) return tilesets[i];
  }
  return null;
}

export function parseInteractables(layer: TiledLayer): InteractionZone[] {
  if (layer.type !== 'objectgroup' || !layer.objects) return [];

  return layer.objects.map((obj) => ({
    name: obj.name,
    type: obj.type,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    roomId: obj.properties?.roomId ?? '',
  }));
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd D:/code/chat-team/frontend && npx vitest run tests/utils/tmxLoader.test.ts`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
cd D:/code/chat-team
git add frontend/src/utils/tmxLoader.ts frontend/tests/utils/tmxLoader.test.ts
git commit -m "feat: add Tiled JSON parser (tmxLoader)"
```

---

### Task 4: 创建 Tiled 地图 JSON

**Files:**
- Create: `frontend/public/assets/maps/the_office.json`

由于我们无法在 CLI 中运行 Tiled 编辑器，我们将直接手写一个 JSON 地图文件，复刻当前 mapConfig 中的 3 房间 + T 形走廊布局。

- [ ] **Step 1: 创建地图 JSON**

基于当前 `mapConfig.ts` 的 24x18 瓦片布局：
- 研发部 (rd): x=7, y=0, w=10, h=9
- 市场部: x=0, y=12, w=9, h=6
- 财务部: x=15, y=12, w=9, h=6
- T 形走廊：水平 (0,10)-(24,12), 垂直 (10,9)-(14,12)

```json
{
  "compressionlevel": -1,
  "height": 18,
  "infinite": false,
  "orientation": "orthogonal",
  "renderorder": "right-down",
  "tileheight": 32,
  "tilewidth": 32,
  "width": 24,
  "tilesets": [
    {
      "firstgid": 1,
      "name": "Room_Builder_32x32",
      "tilewidth": 32,
      "tileheight": 32,
      "columns": 76,
      "image": "tilesets/Room_Builder_32x32.png",
      "imagewidth": 2432,
      "imageheight": 3488
    },
    {
      "firstgid": 8285,
      "name": "interiors_pt1",
      "tilewidth": 32,
      "tileheight": 32,
      "columns": 16,
      "image": "tilesets/interiors_pt1.png",
      "imagewidth": 512,
      "imageheight": 10016
    }
  ],
  "layers": [
    {
      "name": "Floor",
      "type": "tilelayer",
      "visible": true,
      "opacity": 1,
      "data": []
    },
    {
      "name": "Walls",
      "type": "tilelayer",
      "visible": true,
      "opacity": 1,
      "data": []
    },
    {
      "name": "Furniture",
      "type": "tilelayer",
      "visible": true,
      "opacity": 1,
      "data": []
    },
    {
      "name": "Collision",
      "type": "tilelayer",
      "visible": false,
      "opacity": 1,
      "data": []
    },
    {
      "name": "Interactables",
      "type": "objectgroup",
      "visible": true,
      "opacity": 1,
      "objects": [
        {
          "id": 1,
          "name": "round_table",
          "type": "task",
          "x": 320,
          "y": 128,
          "width": 96,
          "height": 96,
          "properties": { "roomId": "rd" }
        },
        {
          "id": 2,
          "name": "cabinet",
          "type": "archive",
          "x": 224,
          "y": 0,
          "width": 64,
          "height": 64,
          "properties": { "roomId": "rd" }
        }
      ]
    }
  ]
}
```

注意：`data` 数组初始为空（全 0），因为我们需要在 Tiled 编辑器中手动绘制或后续填充。当前的 TiledMap 组件需要能正确处理空数据层（全 0 瓦片 = 不渲染任何内容）。

- [ ] **Step 2: 写一个脚本生成基本的地板和墙壁数据**

创建 `frontend/scripts/generate-map.ts` 脚本来填充基础的 floor/wall 瓦片数据。

```typescript
// frontend/scripts/generate-map.ts
// 运行: npx tsx scripts/generate-map.ts
// 用途: 生成基础的办公室地图 JSON（走廊 + 3 房间地板 + 墙壁轮廓）

const MAP_W = 24;
const MAP_H = 18;

// 区域定义（来自 mapConfig.ts）
const areas = {
  rd:         { x: 7,  y: 0,  w: 10, h: 9  },
  horizontal: { x: 0,  y: 10, w: 24, h: 2  },
  vertical:   { x: 10, y: 9,  w: 4,  h: 3  },
  marketing:  { x: 0,  y: 12, w: 9,  h: 6  },
  finance:    { x: 15, y: 12, w: 9,  h: 6  },
};

function createEmptyLayer(): number[] {
  return new Array(MAP_W * MAP_H).fill(0);
}

function inBounds(tx: number, ty: number): boolean {
  for (const area of Object.values(areas)) {
    if (
      tx >= area.x && tx < area.x + area.w &&
      ty >= area.y && ty < area.y + area.h
    ) return true;
  }
  return false;
}

function isEdge(tx: number, ty: number, area: { x: number; y: number; w: number; h: number }): boolean {
  return (
    tx === area.x || tx === area.x + area.w - 1 ||
    ty === area.y || ty === area.y + area.h - 1
  );
}

// Floor layer — fill walkable tiles
const floor = createEmptyLayer();
for (let y = 0; y < MAP_H; y++) {
  for (let x = 0; x < MAP_W; x++) {
    if (inBounds(x, y)) {
      floor[y * MAP_W + x] = 2; // tile ID 2 = basic floor from Room_Builder
    }
  }
}

// Wall layer — edges of rooms
const walls = createEmptyLayer();
for (const area of [areas.rd, areas.marketing, areas.finance]) {
  for (let y = area.y; y < area.y + area.h; y++) {
    for (let x = area.x; x < area.x + area.w; x++) {
      if (isEdge(x, y, area)) {
        walls[y * MAP_W + x] = 1; // tile ID 1 = wall from Room_Builder
      }
    }
  }
}

// Corridor edges
for (let x = 0; x < MAP_W; x++) {
  for (const y of [10, 11]) {
    if (x === 0 || x === MAP_W - 1) {
      walls[y * MAP_W + x] = 1;
    }
  }
}

// 打印为 JSON 数组
console.log('Floor data:');
console.log(JSON.stringify(floor));
console.log('\nWalls data:');
console.log(JSON.stringify(walls));
```

- [ ] **Step 3: 运行脚本生成数据并更新 JSON**

Run: `cd D:/code/chat-team/frontend && npx tsx scripts/generate-map.ts`

将输出的 Floor data 和 Walls data 填入 `the_office.json` 的对应 `data` 字段。

- [ ] **Step 4: Commit**

```bash
cd D:/code/chat-team
git add frontend/public/assets/maps/the_office.json frontend/scripts/
git commit -m "feat: add initial Tiled office map JSON with basic floor and walls"
```

---

### Task 5: 实现 TiledMap 渲染组件

**Files:**
- Create: `frontend/src/components/canvas/TiledMap.tsx`

- [ ] **Step 1: 实现 TiledMap 组件**

```typescript
// frontend/src/components/canvas/TiledMap.tsx
import { useEffect, useRef } from 'react';
import { Container, BaseTexture, Texture } from 'pixi.js';
import { Tilemap } from '@pixi/tilemap';
import { Text } from '@pixi/text';
import { Graphics } from 'pixi.js';
import { useViewport } from './PixiCanvas';
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import {
  loadTiledMap,
  findTilesetForGid,
  resolveTileSourceRect,
  parseInteractables,
  type TiledMapData,
  type TiledTileset,
  type InteractionZone,
} from '../../utils/tmxLoader';

const MAP_PATH = '/assets/maps/the_office.json';
const ASSETS_BASE = '/assets/';

// Depth mapping for layer names
const LAYER_DEPTH: Record<string, number> = {
  Floor: 0,
  Walls: 1,
  Furniture: 2,
  Foreground: 4,
};

export function TiledMap() {
  const viewport = useViewport();
  const openNewTask = useUiStore((s) => s.openNewTaskModal);
  const openArchive = useUiStore((s) => s.openRoomArchive);
  const activeSession = useSessionStore((s) => s.activeSession);
  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;

  useEffect(() => {
    if (!viewport) return;

    let destroyed = false;
    const root = new Container();

    loadTiledMap(MAP_PATH)
      .then((mapData) => {
        if (destroyed) return;
        renderMap(root, mapData, openNewTask, openArchive, activeSessionRef);
      })
      .catch((err) => {
        console.error('Failed to load tiled map:', err);
      });

    viewport.addChild(root);

    return () => {
      destroyed = true;
      viewport.removeChild(root);
      root.destroy({ children: true });
    };
  }, [viewport, openNewTask, openArchive]);

  return null;
}

interface TilesetTextures {
  tileset: TiledTileset;
  texture: Texture;
}

async function renderMap(
  root: Container,
  mapData: TiledMapData,
  openNewTask: (roomId: string) => void,
  openArchive: (roomId: string) => void,
  activeSessionRef: React.MutableRefObject<any>,
) {
  // Load tileset textures
  const tilesetTextures: TilesetTextures[] = [];

  for (const ts of mapData.tilesets) {
    const baseTexture = BaseTexture.from(ASSETS_BASE + ts.image);
    tilesetTextures.push({ tileset: ts, texture: new Texture(baseTexture) });
  }

  // Render tile layers
  for (const layer of mapData.layers) {
    if (layer.type !== 'tilelayer' || !layer.data || !layer.visible) continue;

    const depth = LAYER_DEPTH[layer.name] ?? 1;
    const tilemap = new Tilemap([], { tile: mapData.tileWidth, tileHeight: mapData.tileHeight });

    for (let i = 0; i < layer.data.length; i++) {
      const gid = layer.data[i];
      if (gid === 0) continue;

      const tsInfo = findTilesetForGid(mapData.tilesets, gid);
      if (!tsInfo) continue;

      const texInfo = tilesetTextures.find((t) => t.tileset === tsInfo);
      if (!texInfo) continue;

      const col = i % mapData.width;
      const row = Math.floor(i / mapData.width);
      const srcRect = resolveTileSourceRect(tsInfo, gid);

      const tileTexture = new Texture(texInfo.texture.baseTexture, srcRect);
      tilemap.tile(tileTexture, col * mapData.tileWidth, row * mapData.tileHeight);
    }

    tilemap.depth = depth;
    root.addChild(tilemap);
  }

  // Render interactable zones from objectgroup layers
  for (const layer of mapData.layers) {
    if (layer.type !== 'objectgroup') continue;

    const zones = parseInteractables(layer);
    for (const zone of zones) {
      const hitArea = new Container();
      hitArea.eventMode = 'static';
      hitArea.cursor = 'pointer';

      if (zone.type === 'task') {
        const hit = new Graphics();
        hit.beginFill(0xffffff, 0);
        hit.drawEllipse(
          zone.x + zone.width / 2,
          zone.y + zone.height / 2,
          zone.width / 2,
          zone.height / 2,
        );
        hit.endFill();
        hitArea.addChild(hit);

        const glow = new Graphics();
        glow.beginFill(0xffff00, 0.15);
        glow.drawEllipse(
          zone.x + zone.width / 2,
          zone.y + zone.height / 2,
          zone.width / 2,
          zone.height / 2,
        );
        glow.endFill();
        glow.alpha = 0;
        hitArea.addChild(glow);

        hitArea.on('pointerover', () => { glow.alpha = 1; });
        hitArea.on('pointerout', () => { glow.alpha = 0; });
        hitArea.on('pointerdown', () => {
          if (activeSessionRef.current?.status === 'running') return;
          openNewTask(zone.roomId);
        });
      } else if (zone.type === 'archive') {
        const hit = new Graphics();
        hit.beginFill(0xffffff, 0);
        hit.drawRect(zone.x, zone.y, zone.width, zone.height);
        hit.endFill();
        hitArea.addChild(hit);

        const highlight = new Graphics();
        highlight.beginFill(0xffffff, 0.15);
        highlight.drawRoundedRect(zone.x + 1, zone.y + 1, zone.width - 2, zone.height - 2, 2);
        highlight.endFill();
        highlight.alpha = 0;
        hitArea.addChild(highlight);

        hitArea.on('pointerover', () => { highlight.alpha = 1; });
        hitArea.on('pointerout', () => { highlight.alpha = 0; });
        hitArea.on('pointerdown', () => {
          openArchive(zone.roomId);
        });
      }

      hitArea.depth = 3;
      root.addChild(hitArea);
    }
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run: `cd D:/code/chat-team/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
cd D:/code/chat-team
git add frontend/src/components/canvas/TiledMap.tsx
git commit -m "feat: add TiledMap component with tilemap rendering and interaction zones"
```

---

### Task 6: 切换 App.tsx 和 PixiCanvas.tsx 使用 TiledMap

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/canvas/PixiCanvas.tsx`
- Delete: `frontend/src/components/canvas/OfficeMap.tsx`

- [ ] **Step 1: 更新 App.tsx — 替换 OfficeMap 为 TiledMap**

```typescript
// frontend/src/App.tsx — 替换 import 和 JSX
// 改前:
import { OfficeMap } from './components/canvas/OfficeMap';
// 改后:
import { TiledMap } from './components/canvas/TiledMap';

// 改前:
<OfficeMap />
// 改后:
<TiledMap />
```

- [ ] **Step 2: 更新 PixiCanvas.tsx — 地图尺寸从 tmxLoader 加载**

PixiCanvas 中的 `worldWidth/worldHeight` 当前来自 `MAP_CONFIG`。改为使用 Tiled 地图的实际尺寸。但 Tiled 地图是异步加载的，所以保留 MAP_CONFIG 中的尺寸作为初始值（24*32=768, 18*32=576），与 Tiled 地图尺寸一致。

无需修改 PixiCanvas.tsx——当前地图尺寸 24x18 保持不变。

- [ ] **Step 3: 删除 OfficeMap.tsx**

```bash
rm frontend/src/components/canvas/OfficeMap.tsx
```

- [ ] **Step 4: 清理 mapConfig.ts 中被 Tiled 替代的布局定义**

保留 `MAP_CONFIG` 中的 `tileWidth/tileHeight/mapWidth/mapHeight`（PixiCanvas 仍在使用），删除 `ROOMS` 数组和 `RoomDef/FurnitureItem` 类型（已移入 Tiled 地图和 Interactables 层）。

但 AgentSprite.tsx 和 FlyingDocument.tsx 当前 import 了 `ROOMS`：
- `AgentSprite.tsx:6` — `import { MAP_CONFIG, ROOMS } from '../../data/mapConfig';`
- `FlyingDocument.tsx:6` — `import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';`

这两个文件用 `ROOMS` 来查找 agent 的座位位置。需要保留座位数据。

修改 `mapConfig.ts`——保留 `MAP_CONFIG` 和一个简化的 `AGENT_SEATS` 映射：

```typescript
// frontend/src/data/mapConfig.ts
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

// Agent seats — used by AgentSprite and FlyingDocument for positioning
// These correspond to Interactables objects of type "agent_seat" in the Tiled map
export const AGENT_SEATS: Record<string, { x: number; y: number; roomId: string }> = {
  analyst: { x: 11, y: 3, roomId: 'rd' },
  architect: { x: 14, y: 5, roomId: 'rd' },
  'dev-lead': { x: 11, y: 7, roomId: 'rd' },
  'test-lead': { x: 8, y: 5, roomId: 'rd' },
};
```

- [ ] **Step 5: 更新 AgentSprite.tsx 中的 import**

```typescript
// AgentSprite.tsx line 6 — 替换:
import { MAP_CONFIG, ROOMS } from '../../data/mapConfig';
// 改为:
import { MAP_CONFIG, AGENT_SEATS } from '../../data/mapConfig';
```

更新座位查找逻辑（line 127-128）：

```typescript
// 替换:
const room = ROOMS.find((r) => r.agents.includes(agentId));
const seat = room?.seats[agentId] ?? config.position;
// 改为:
const seat = AGENT_SEATS[agentId] ?? { x: config.position.x, y: config.position.y };
```

- [ ] **Step 6: 更新 FlyingDocument.tsx 中的 import**

```typescript
// FlyingDocument.tsx line 6 — 替换:
import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';
// 改为:
import { MAP_CONFIG, AGENT_SEATS } from '../../data/mapConfig';
```

更新 `getAgentPosition` 函数（line 23-28）：

```typescript
function getAgentPosition(agentId: string): { x: number; y: number } {
  const config = AGENT_CONFIGS[agentId]!;
  const seat = AGENT_SEATS[agentId];
  const pos = seat ?? config.position;
  return { x: pos.x * MAP_CONFIG.tileWidth, y: pos.y * MAP_CONFIG.tileHeight };
}
```

- [ ] **Step 7: 验证 TypeScript 编译通过**

Run: `cd D:/code/chat-team/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 8: 运行全部测试**

Run: `cd D:/code/chat-team/frontend && npm run test`
Expected: 所有测试通过

- [ ] **Step 9: Commit**

```bash
cd D:/code/chat-team
git add frontend/src/App.tsx frontend/src/data/mapConfig.ts frontend/src/components/canvas/AgentSprite.tsx frontend/src/components/canvas/FlyingDocument.tsx
git rm frontend/src/components/canvas/OfficeMap.tsx
git commit -m "feat: switch from OfficeMap to TiledMap rendering"
```

---

### Task 7: 视觉验证与地图美化

**Files:**
- Modify: `frontend/public/assets/maps/the_office.json`

此任务需要手动在浏览器中验证，并根据视觉效果调整地图数据。

- [ ] **Step 1: 启动前后端**

```bash
cd D:/code/chat-team/backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
cd D:/code/chat-team/frontend && npm run dev
```

- [ ] **Step 2: 打开浏览器验证**

打开 http://localhost:3000，检查：
1. 地板瓦片是否正确渲染
2. 墙壁瓦片是否正确渲染
3. 交互区域是否可点击（新建任务、归档）
4. Agent 精灵是否在正确位置显示
5. 飞行文档动画是否正常
6. 庆祝动画是否正常
7. Viewport 拖拽/缩放是否正常

- [ ] **Step 3: 调整地图数据（如果需要）**

根据视觉效果调整 `the_office.json` 中的瓦片 ID：
- 更换地板瓦片样式
- 添加家具瓦片（使用 interiors_pt1 的 GID）
- 调整墙壁样式

- [ ] **Step 4: Commit**

```bash
cd D:/code/chat-team
git add frontend/public/assets/maps/the_office.json
git commit -m "feat: refine office map tile layout"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 素材复制 — Task 1
- ✅ @pixi/tilemap 依赖 — Task 2
- ✅ tmxLoader 解析器 + 测试 — Task 3
- ✅ 地图 JSON — Task 4
- ✅ TiledMap 组件 — Task 5
- ✅ App/PixiCanvas/AgentSprite/FlyingDocument 集成 — Task 6
- ✅ 视觉验证 — Task 7
- ✅ 交互处理（task/archive） — Task 5
- ✅ Z-ordering (depth) — Task 5
- ✅ OfficeMap 删除 — Task 6

**Placeholder scan:** No TBD/TODO/fill-in-later found.

**Type consistency:**
- `TiledMapData`, `TiledTileset`, `TiledLayer`, `TiledObject`, `InteractionZone` — defined in Task 3, used consistently in Task 5
- `AGENT_SEATS` — defined in Task 6, used in AgentSprite and FlyingDocument
- `MAP_CONFIG` — preserved throughout
