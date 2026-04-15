# AgentOffice Canvas 层游戏化改造设计文档

**日期**: 2026-04-15
**状态**: Approved
**范围**: Canvas 层重写 — AI Town 风格角色精灵 + 程序化办公室地图 + 帧动画 + 视口控制 + 视觉特效
**前提**: 保留现有 Overlay 组件、Zustand Store、WebSocket Hook、API Service 不变

---

## 1. 概述

当前前端的 Canvas 层是占位符实现（几何矩形房间 + 彩色圆点角色），与设计文档描述的 AI Town 风格游戏化沉浸体验差距很大。本次改造仅重写 Canvas 层，实现设计文档中规划的完整视觉体验。

### 1.1 改造范围

- **重写**: PixiCanvas.tsx、OfficeMap.tsx、AgentSprite.tsx
- **新增**: ThinkingBubble.tsx、FlyingDocument.tsx
- **微调**: agentConfig.ts、mapConfig.ts、agentStore.ts
- **素材**: 从 AI Town 仓库下载 4 张角色精灵图 PNG
- **不动**: 所有 Overlay 组件、sessionStore、uiStore、useWebSocket、api.ts

### 1.2 核心决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 角色素材 | AI Town spritesheet PNG (MIT) | 设计文档指定，16×16 像素，4 方向 × 3 帧 |
| 办公室地图 | PixiJS Graphics API 程序化绘制 | 无需外部瓦片素材，风格统一可控 |
| 动画系统 | 帧动画状态机 | AI Town 验证过的模式 |
| 视口控制 | pixi-viewport (drag + wheel + decelerate + clamp) | 设计文档指定 |
| 与 Overlay 集成 | 不改动 Overlay，仅 Canvas 层渲染升级 | 最小改动原则 |

---

## 2. 素材

### 2.1 角色精灵图

从 AI Town 仓库 (`a16z-infra/ai-town`) 下载以下文件，放入 `frontend/public/assets/spritesheets/`：

| 文件 | 角色 | AI Town 角色名 |
|------|------|---------------|
| f1.png | analyst | Lucky 风格 |
| f3.png | writer | Alice 风格 |
| f4.png | architect | Bob 风格 |
| f6.png | researcher | Stella 风格 |

每张 PNG 尺寸 64×64 像素（4 行 × 3 列，每帧 16×16）：
- 第 1 行：down 方向（3 帧）
- 第 2 行：up 方向（3 帧）
- 第 3 行：right 方向（3 帧）
- 第 4 行：left 方向（3 帧）

现有的 `spritesheets/f1.ts` 等帧定义数据已就绪，与 PNG 布局匹配。

### 2.2 办公室地图

无需外部素材。用 PixiJS Graphics API 程序化绘制：
- 房间地板：不同色调的矩形填充
- 墙壁：深色矩形边框
- 走廊：连接房间的通道
- 家具：简单几何图形（矩形桌子、圆形椅子、白色矩形白板等）
- 标签：PixiJS Text 渲染房间名称

---

## 3. 组件设计

### 3.1 PixiCanvas.tsx（重写）

职责：初始化 PixiJS Stage + pixi-viewport，挂载子组件。

```
PixiCanvas
├── Viewport (pixi-viewport)
│   ├── OfficeMap
│   ├── AgentSprite × 4
│   ├── ThinkingBubble (条件渲染)
│   └── FlyingDocument (事件触发)
```

pixi-viewport 配置：
- **drag**: 鼠标拖拽平移
- **wheel**: 滚轮平滑缩放
- **decelerate**: 松手后惯性滑动（friction = 0.9）
- **clamp**: 拖拽不超出地图边界
- **clampZoom**: 缩放范围 0.5x ~ 3x
- 初始状态：居中显示完整办公室，缩放级别适应屏幕

### 3.2 OfficeMap.tsx（重写）

职责：程序化绘制办公室地图。

地图规格（沿用现有 mapConfig.ts 的 20×16 瓦片，32×32 像素/瓦片）：

| 区域 | 底色 | 家具元素 |
|------|------|---------|
| 会议室 (meeting) | 较暖色调 | 会议桌（矩形）、6 把椅子（小圆）、白板（白色矩形）、投影屏 |
| 设计中心 (design) | 较冷色调 | 双工位桌（两个矩形）、椅子、大屏幕（矩形）、白板墙 |
| 撰写区 (writing) | 偏绿安静色调 | 单人桌、椅子、书架（矩形 + 横线）、台灯 |
| 档案柜 (archive) | 中性色调 | 文件柜（多个矩形叠加）、公告板、产出展示架 |
| 走廊 | 深灰色 | 地砖纹理（可选） |

房间之间由走廊连接，走廊宽度 2 个瓦片。

支持点击交互：点击房间区域触发 uiStore 中对应的交互（查看档案、查看文档等）。

### 3.3 AgentSprite.tsx（重写）

职责：加载 spritesheet，根据状态播放帧动画，平滑移动。

**动画状态机**：

```
idle ←→ walking  (phase:started → walking, 到达目标 → idle/working)
working ←→ thinking  (agent:thinking → thinking, agent:working → working)
任何状态 → idle  (agent:completed, phase:completed)
```

| 状态 | 动画帧 | 速度 | 附加效果 |
|------|--------|------|---------|
| idle | down 方向 3 帧 | 0.08 (慢) | 呼吸微动（小幅上下浮动） |
| walking | 对应方向 3 帧 | 0.15 (正常) | 无 |
| working | down 方向 3 帧 | 0.08 (慢) | 可选：键盘敲击粒子 |
| thinking | down 方向 3 帧 | 0.08 (慢) | 显示 ThinkingBubble |

**移动机制**：
- agentStore 中 position 变更时，设置 targetPosition
- 用 PixiJS Ticker 做 lerp 插值（速度：每秒 3 瓦片）
- 移动中 state 自动切换为 walking，方向由起终点差值决定（dx > dy → left/right, 否则 → up/down）
- 到达目标位置后恢复之前的状态

**渲染**：
- 精灵缩放 2x（16×16 → 32×32 像素）
- 角色名称标签渲染在精灵下方

### 3.4 ThinkingBubble.tsx（新增）

职责：thinking 状态时在角色头顶显示思考内容气泡。

实现：
- 用 PixiJS Graphics 绘制圆角矩形 + 底部三角尾巴
- 用 PixiJS BitmapText/Text 渲染 thoughtText（截断前 50 字）
- 固定在角色精灵上方 20px，跟随角色移动
- 出现/消失时 alpha 淡入淡出（0.3 秒）
- 背景：白色半透明，文字：深灰色
- 最大宽度 120 像素，超出换行

### 3.5 FlyingDocument.tsx（新增）

职责：agent:output 事件触发时，文件图标从 Agent 飞向档案柜。

实现：
- 用 PixiJS Graphics 绘制简单文件图标（矩形 + 折角）
- 运动轨迹：二次贝塞尔曲线（抛物线），从 Agent 位置到档案柜区域
- 飞行时间 ~0.8 秒
- 到达后 alpha 淡出（0.2 秒）
- 由 PixiJS Ticker 驱动动画
- 组件维护一个飞行中队列，支持同时多个文件飞行

### 3.6 Celebration 特效

职责：session:completed 时全场景粒子效果。

实现：
- 在 PixiCanvas 层面处理，不作为独立组件
- 触发时生成 30-50 个彩色矩形粒子（ParticleContainer）
- 粒子从屏幕中心向四周散射，带重力下落
- 2 秒后自动淡出并清理
- 颜色从 4 个 Agent 的主题色中随机选取

---

## 4. 数据变更

### 4.1 agentStore 扩展

在现有 AgentVisualState 接口中新增字段：

```typescript
interface AgentVisualState {
  // 现有字段（不变）
  agentId: string;
  state: 'idle' | 'walking' | 'working' | 'thinking';
  position: { x: number; y: number };
  thoughtText: string;
  toolName: string;
  outputFiles: string[];

  // 新增字段
  direction: 'down' | 'up' | 'left' | 'right';
  targetPosition: { x: number; y: number } | null;
  room: string;
}
```

direction 默认 'down'，targetPosition 默认 null，room 从 agentConfig 初始房间获取。

### 4.2 agentConfig.ts 扩展

在现有 AgentVisualConfig 接口中新增：

```typescript
interface AgentVisualConfig {
  // 现有字段（不变）
  agentId: string;
  spriteKey: string;
  spriteUrl: string;
  room: string;
  position: { x: number; y: number };

  // 新增字段
  homePosition: { x: number; y: number };  // 默认工位位置
  animationSpeed: {
    idle: number;      // 0.08
    walking: number;   // 0.15
    working: number;   // 0.08
    thinking: number;  // 0.08
  };
}
```

### 4.3 mapConfig.ts 扩展

在现有房间定义中新增家具和走廊数据：

```typescript
interface FurnitureItem {
  type: 'desk' | 'chair' | 'whiteboard' | 'screen' | 'bookshelf' | 'cabinet' | 'lamp';
  x: number; y: number;
  width: number; height: number;
  color: number;
}

interface Corridor {
  from: string;  // 房间名
  to: string;    // 房间名
  path: { x: number; y: number }[];  // 走廊瓦片坐标
}

interface RoomConfig {
  // 现有字段
  id: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  floorColor: number;
  // 新增字段
  furniture: FurnitureItem[];
}
```

---

## 5. 数据流

```
后端 WebSocket
    │
    ↓  WS 事件
    │
useWebSocket.ts ─── 解析事件 ──→ agentStore 更新
    │                                    │
    │                     ┌──────────────┼──────────────┐
    │                     ↓              ↓              ↓
    │              AgentSprite      ThinkingBubble  FlyingDocument
    │              (订阅 state,    (订阅 state,     (监听 agent:output
    │               position,       thoughtText)     触发飞行动画)
    │               direction)
    │                     │
    │              PixiJS Ticker 驱动帧动画和移动插值
    │
    ↓
Overlay 组件 (不变，继续从 store 读取)
```

WebSocket 事件到 Canvas 动画的映射：

| WS 事件 | AgentSprite 动作 | 特效组件 |
|---------|-----------------|---------|
| `phase:started` | 移动到对应房间 (walking → working) | — |
| `agent:thinking` | thinking 姿态 | ThinkingBubble 显示 |
| `agent:working` | working 姿态 | ThinkingBubble 隐藏 |
| `agent:output` | 保持 working | FlyingDocument 触发 |
| `agent:completed` | 完成光效 → idle | — |
| `phase:completed` | 回到 idle 位置 | — |
| `session:completed` | idle | Celebration 粒子 |
| `session:failed` | 红色闪烁 | — |

---

## 6. 文件变更清单

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `components/canvas/PixiCanvas.tsx` | 重写 | 加入 pixi-viewport 初始化 |
| `components/canvas/OfficeMap.tsx` | 重写 | 程序化绘制办公室（房间+家具+走廊） |
| `components/canvas/AgentSprite.tsx` | 重写 | spritesheet 加载 + 帧动画状态机 + 移动插值 |
| `components/canvas/ThinkingBubble.tsx` | 新增 | 思考气泡特效 |
| `components/canvas/FlyingDocument.tsx` | 新增 | 文件飞行动画 |
| `data/agentConfig.ts` | 微调 | 新增 homePosition、animationSpeed |
| `data/mapConfig.ts` | 微调 | 新增 furniture、corridors 数据 |
| `stores/agentStore.ts` | 微调 | 新增 direction、targetPosition、room 字段 |
| `public/assets/spritesheets/f1.png` | 新增 | AI Town analyst 精灵图 |
| `public/assets/spritesheets/f3.png` | 新增 | AI Town writer 精灵图 |
| `public/assets/spritesheets/f4.png` | 新增 | AI Town architect 精灵图 |
| `public/assets/spritesheets/f6.png` | 新增 | AI Town researcher 精灵图 |
