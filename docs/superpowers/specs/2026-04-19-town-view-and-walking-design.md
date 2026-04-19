# 全小镇视角 + 图书馆内随机漫步 + Analyst 头像

**日期**: 2026-04-19
**状态**: Approved

## 概述

三个前端改动：
1. 摄像机从聚焦图书馆恢复为全小镇自由视角
2. 四个 agent 在空闲时于图书馆内随机漫步（碰墙换方向）
3. Analyst 在详情面板中显示 Mei Lin 头像

## 1. 全小镇自由视角

### 当前状态

`OfficeScene.ts` 中摄像机硬编码聚焦图书馆 (118,19) 位置，7x11 格子范围，`setBounds` 限制用户无法拖出图书馆。

### 改动

在 `OfficeScene.ts` 的 `create()` 中：

- **移除**当前的 `centerOn`/`setZoom`/`setBounds` 图书馆聚焦逻辑
- **改为**：计算全地图 (140x100 tiles) 的缩放比例，使整张地图适配窗口
- **初始缩放**: `Math.min(width / (140 * TILE_SIZE), height / (100 * TILE_SIZE))`
- **初始居中**: `camera.centerOn(70 * TILE_SIZE, 50 * TILE_SIZE)`
- **边界**: `camera.setBounds(0, 0, 140 * TILE_SIZE, 100 * TILE_SIZE)`
- **缩放范围**: 最小到全览，最大到 `3x`（能看到单个角色细节）

### 交互

- **鼠标拖拽平移**: 监听 `pointerdown`/`pointermove`/`pointerup`，计算 delta 移动 camera
- **滚轮缩放**: 监听 `wheel` 事件，以鼠标位置为中心缩放
- **resize 时**: 重新计算缩放和居中

### 涉及文件

- `frontend/src/game/OfficeScene.ts`

## 2. 图书馆内随机漫步

### 行走区域

图书馆位于全地图 (118,19) 到 (124,29)，即 7x11 格子。

### 碰撞数据

从 `the_ville.json` 中找出非空 tile layer（如墙壁、家具等），提取图书馆区域 (col 118-124, row 19-29) 内各格子的碰撞信息，缓存为 `boolean[7][11]` 的可行走数组。初始方案：如果某格子在所有可见 layer 中都没有 tile，则标记为可行走；否则标记为不可行走。后续可微调排除纯地板装饰 layer。

### 行走状态机

```
SEATED (默认，坐在座位上)
  └─ 等待 2-5 秒随机延迟 → CHOOSING_DIRECTION

CHOOSING_DIRECTION
  └─ 随机选一个方向(up/down/left/right) → 检测前方格子
     → 可走: WALKING (剩余步数 = random(1,3))
     → 不可走: 重新选方向(最多4次) → 全被堵则回到 SEATED

WALKING
  └─ 每步移动 1 tile (tween, 300ms)
     → 剩余步数 > 0 且前方可走: 继续 WALKING
     → 剩余步数 = 0: 回到 SEATED
     → 前方不可走: 回到 CHOOSING_DIRECTION

任何状态 + 收到 working/thinking 事件:
  └─ 中断当前动作 → tween 回座位 → SEATED
```

### 与 agent 状态的集成

- `agentStore` 中 agent 的 `animationState` 变为 `working`/`thinking` 时，立即停止漫步，tween 回座位位置
- `animationState` 回到 `idle` 时，等待 2-5 秒后开始漫步
- 漫步中实时更新 sprite 深度（基于 y 坐标），确保正确的遮挡关系

### 方向与动画

- 4 方向：up (misa-back-walk), down (misa-front-walk), left (misa-left-walk), right (misa-right-walk)
- 行走时播放对应方向的 walk 动画
- 停止时显示该方向的 idle 帧

### 涉及文件

- `frontend/src/game/AgentSpriteFactory.ts` — 添加 `RandomWalker` 类
- `frontend/src/game/OfficeScene.ts` — 初始化 walker 实例，与 agent sprite 绑定
- `frontend/src/game/types.ts` — 可能需要扩展类型

## 3. Analyst Mei Lin 头像

### 实现

- 将 `Mei_Lin.png` 复制到 `frontend/public/assets/avatars/analyst.png`
- 在 `AgentDetailPanel.tsx` 中，analyst 的详情面板头部显示该头像
- 头像大小约 48x48px，圆形裁剪
- 其他三个 agent 暂不添加头像（可后续扩展）

### 涉及文件

- `frontend/public/assets/avatars/analyst.png` (新增)
- `frontend/src/components/overlay/AgentDetailPanel.tsx`

## 不涉及的内容

- 不改后端
- 不引入新的 npm 依赖
- 不改 agent 角色定义（analyst 仍是需求分析师）
- 不实现 BFS 寻路
- 不支持全小镇范围行走（仅图书馆内）
