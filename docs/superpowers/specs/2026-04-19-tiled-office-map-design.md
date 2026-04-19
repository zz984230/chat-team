# Tiled 办公室地图渲染设计

日期: 2026-04-19

## 概述

将当前 OfficeMap 中基于 PixiJS Graphics 原语（drawRect/drawCircle/drawEllipse）绘制的办公室场景，替换为基于 Tiled 编辑器的瓦片地图渲染。复用斯坦福小镇（generative_agents）项目的 Cute RPG 室内素材，使用 @pixi/tilemap 插件在 PixiJS 中加载和渲染 Tiled 导出的 JSON 地图。

## 动机

当前办公室场景完全用代码硬编码绘制，视觉效果简陋，调整布局需要修改代码。Tiled 编辑器提供所见即所得的地图编辑体验，加上 Cute RPG 像素风素材，可以显著提升视觉品质和可维护性。

## 素材来源

从 `D:\code\generative_agents\environment\frontend_server\static_dirs\assets\the_ville\visuals\map_assets\` 复制以下文件到 `frontend/public/assets/tilesets/`：

| 文件 | 用途 | 大小 |
|------|------|------|
| `v1/Room_Builder_32x32.png` | 墙壁、地板、门、窗 | 394KB |
| `v1/interiors_pt1.png` | 家具（桌、椅、沙发等）第1部分 | 600KB |
| `v1/interiors_pt2.png` | 家具第2部分 | 745KB |
| `v1/interiors_pt3.png` | 家具第3部分 | 799KB |
| `v1/interiors_pt4.png` | 家具第4部分 | 319KB |
| `v1/interiors_pt5.png` | 家具第5部分 | 720KB |
| `blocks/blocks_1.png` | 碰撞/不可通行标记 | 小 |

素材归属：Background art - PixyMoon (@_PixyMoon_), Furniture/interior - LimeZu (@lime_px)

## 文件组织

```
frontend/public/assets/
  tilesets/
    Room_Builder_32x32.png
    interiors_pt1.png
    interiors_pt2.png
    interiors_pt3.png
    interiors_pt4.png
    interiors_pt5.png
    blocks_1.png
  maps/
    the_office.json          ← Tiled 导出的地图数据
```

## 新增依赖

- `@pixi/tilemap` — PixiJS 官方瓦片地图渲染插件（唯一新增 npm 包）

## 架构设计

### 组件层级

```
PixiCanvas.tsx (不变)
└── ViewportLayer (不变)
    ├── TiledMap.tsx (新组件，替代 OfficeMap.tsx)
    │   ├── 加载 the_office.json + tileset 图片
    │   ├── 按层创建 @pixi/tilemap 实例
    │   ├── 渲染地板、墙壁、家具层
    │   └── 处理可交互区域点击事件
    ├── AgentSprite.tsx (不变)
    ├── FlyingDocument.tsx (不变)
    └── CelebrationEffect.tsx (不变)
```

### TMX 加载器 (`frontend/src/utils/tmxLoader.ts`)

解析 Tiled 导出的 JSON 格式：

```typescript
interface TiledMapData {
  width: number;           // 瓦片列数
  height: number;          // 瓦片行数
  tileWidth: number;       // 瓦片像素宽
  tileHeight: number;      // 瓦片像素高
  tilesets: TiledTileset[];
  layers: TiledLayer[];
}

interface TiledTileset {
  firstgid: number;        // 起始全局瓦片 ID
  name: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;         // 瓦片集列数
  image: string;           // 图片路径
  imageWidth: number;
  imageHeight: number;
}

interface TiledLayer {
  name: string;
  type: "tilelayer" | "objectgroup";
  data?: number[];         // 瓦片 ID 数组（tilelayer）
  objects?: TiledObject[]; // 对象数组（objectgroup）
  visible: boolean;
  opacity: number;
  properties?: Record<string, any>;
}

interface TiledObject {
  id: number;
  name: string;
  type: string;            // "task" | "archive" | "agent_seat" 等
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: Record<string, any>;
}
```

核心方法：
- `fetchAndParse(jsonPath: string): Promise<TiledMapData>` — 加载 JSON 并解析结构
- `resolveTileTexture(tileset: TiledTileset, tileId: number): Texture` — 根据 GID 计算源矩形并返回纹理
- `parseInteractables(layer: TiledLayer): InteractionZone[]` — 提取可交互区域

### TiledMap 组件 (`frontend/src/components/canvas/TiledMap.tsx`)

替代当前 OfficeMap.tsx 的职责：
1. 在 useEffect 中调用 tmxLoader 加载地图数据
2. 为每个 tilelayer 创建 @pixi/tilemap 实例
3. 遍历层中每个瓦片 ID，设置对应纹理
4. 处理 objectgroup 层的交互区域
5. 渲染房间标签

### Z-Ordering（深度排序）

| Depth | 内容 |
|-------|------|
| 0 | 地板层 (Floor) |
| 1 | 墙壁层 (Walls) |
| 2 | 家具底层 (Furniture) |
| 3 | AgentSprite（按 y 坐标动态排序） |
| 4 | 家具顶层/前景 (Foreground) |
| 5 | 特效层 (FlyingDocument, Celebration) |

AgentSprite 需要在 update 循环中根据 y 坐标动态调整 depth，确保与家具形成正确的前后遮挡关系。

### 交互处理

Tiled 地图中的 `Interactables` Object 层定义可交互区域：
- `type: "task"` — 点击触发新建任务
- `type: "archive"` — 点击打开归档
- `type: "agent_seat"` — 标记 agent 座位位置

TiledMap 组件解析这些对象，生成与当前 mapConfig 类似的交互区域（带高亮和点击事件的 Container），保持现有交互行为不变。

## Tiled 编辑工作流

1. 在 Tiled 中新建地图：30x20 瓦片（或根据当前 mapConfig 调整），32px，正交视角
2. 添加 tileset：导入 Room_Builder_32x32.png 和 interiors_pt*.png
3. 创建图层（从下到上）：
   - `Floor` — 地板瓷砖
   - `Walls` — 墙壁和门
   - `Furniture` — 桌椅、白板、屏幕等
   - `Foreground` — 前景遮挡物
   - `Collision` — 碰撞区域（属性 `collide=true`，不可见）
   - `Interactables`（Object 层）— 可点击区域
4. 按当前 3 房间 + T 形走廊布局绘制
5. 导出为 JSON → 放入 `frontend/public/assets/maps/the_office.json`

## 改动范围

### 新增文件
- `frontend/src/utils/tmxLoader.ts` — TMX JSON 解析器
- `frontend/src/components/canvas/TiledMap.tsx` — 瓦片地图渲染组件
- `frontend/public/assets/tilesets/*.png` — 素材文件
- `frontend/public/assets/maps/the_office.json` — 地图数据

### 修改文件
- `frontend/src/components/canvas/PixiCanvas.tsx` — 用 TiledMap 替换 OfficeMap
- `frontend/src/data/mapConfig.ts` — 保留 agent 座位等运行时数据，移除静态布局定义
- `frontend/package.json` — 添加 @pixi/tilemap 依赖

### 不改动
- `PixiCanvas.tsx` 的 Viewport 逻辑
- `AgentSprite.tsx` 及角色动画
- `FlyingDocument.tsx` / `CelebrationEffect.tsx`
- 所有 overlay 组件（StatusBar、AgentDetailPanel、DocViewer 等）
- 所有 Zustand store
- 后端代码

### 可删除文件
- `frontend/src/components/canvas/OfficeMap.tsx` — 被 TiledMap 完全替代
- `frontend/src/data/mapConfig.ts` 中的 ROOMS 布局定义 — 移入 Tiled 地图

## 测试策略

- `tmxLoader.test.ts` — 用 mock JSON 测试解析逻辑（瓦片 ID 计算、图层提取、交互区域解析）
- `TiledMap.test.tsx` — 测试渲染输出（正确创建 tilemap 层、设置 depth）
- 手动视觉验证：Tiled 编辑器中看到的效果与浏览器渲染一致
