# 角色精灵升级与缩放修复设计

**日期**: 2026-04-19
**状态**: 待实现

## 概述

三个前端改进：
1. 将圆圈精灵替换为 atlas 精灵表角色（含行走动画）
2. 移除角色名字标签
3. 修复鼠标位置居中缩放

## 背景

当前 `AgentSpriteFactory` 使用 `Phaser.GameObjects.Arc`（7px 彩色圆圈）表示角色，带有白色方向指示点和名字标签。项目中已有 `atlas.json` + `atlas.png`（TexturePacker 格式），包含 "misa" 角色的完整四方向行走动画帧数据，但未使用。

## 方案选择

**选定方案**: Atlas 精灵表 + 按角色着色（方案 A）

- 加载 atlas spritesheet，用 `seat.tint` 着色区分四个角色
- 行走时播放帧动画，静止时显示站立帧
- 改动最小，动画数据齐全

## 详细设计

### 1. 精灵系统重构

#### 1.1 AgentVisual 接口变更 (`game/types.ts`)

```typescript
export interface AgentVisual {
  agentId: string;
  body: Phaser.GameObjects.Sprite;   // Arc → Sprite
  // dirDot: 已移除
  // nameText: 已移除
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleText: Phaser.GameObjects.Text;
  bubbleBg: Phaser.GameObjects.Graphics;
  direction: AgentDirection;
  animState: AgentAnimationState;
}
```

#### 1.2 资源加载 (`OfficeScene.preload()`)

添加 atlas 加载：
```typescript
this.load.atlas('agents', 'assets/sprites/atlas.png', 'assets/sprites/atlas.json');
```

#### 1.3 动画定义 (`defineAnimations()`)

从 atlas 帧名创建 8 组 Phaser Animation：

| 动画 key | 帧 | 用途 |
|----------|------|------|
| `idle-front` | `misa-front` | 面朝下站立 |
| `idle-back` | `misa-back` | 面朝上站立 |
| `idle-left` | `misa-left` | 面朝左站立 |
| `idle-right` | `misa-right` | 面朝右站立 |
| `walk-front` | `misa-front-walk.000` ~ `.003` | 面朝下行走 |
| `walk-back` | `misa-back-walk.000` ~ `.003` | 面朝上行走 |
| `walk-left` | `misa-left-walk.000` ~ `.003` | 面朝左行走 |
| `walk-right` | `misa-right-walk.000` ~ `.003` | 面朝右行走 |

行走动画帧率 8fps，循环播放 `-1`。

#### 1.4 createAgentVisual() 重写

- `scene.add.sprite(px, py, 'agents', 'misa-front')` 替代 `scene.add.circle()`
- 设置 origin 为 `(0.5, 1)` 使角色底部对齐格子中心
- 应用 `seat.tint` 着色
- 保留点击交互 `setInteractive({ useHandCursor: true })`
- 不创建 `dirDot` 和 `nameText`

#### 1.5 playAnimation() 重写

根据 `(animState, direction)` 映射到动画 key：
- `idle` + direction → `idle-{direction}`
- `walking` + direction → `walk-{direction}`
- 其他状态（working/thinking）→ `idle-down`

#### 1.6 syncPosition() 简化

移除 `dirDot` 和 `nameText` 的同步代码，仅保留：
- `body.setDepth(y)`
- `bubbleContainer.setPosition(x, y - spriteHeight)`

气泡位置需要根据精灵实际高度调整（大约 y - 48px）。

### 2. 缩放修复

#### 2.1 问题分析

当前 `wheel` handler 使用 `getWorldPoint` 前后对比 + scroll 修正，逻辑正确。但 `cam.setBounds()` 在 `scrollX += ...` 时钳制了 scroll 值，导致修正被部分抵消，表现为缩放不以鼠标为中心。

#### 2.2 修复方案

在 wheel handler 中：
1. 暂时解除 bounds（设为极大值）
2. 执行 zoom + scroll 修正
3. 恢复原始 bounds（Phaser 自动钳制到有效范围）

```typescript
this.input.on('wheel', (pointer, _gameObjects, _dx, dy) => {
  const zoomFactor = dy > 0 ? 0.9 : 1.1;
  const newZoom = Phaser.Math.Clamp(cam.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);

  // 暂时解除 bounds 限制
  cam.setBounds(0, 0, mapPixelW * 10, mapPixelH * 10);

  const worldBefore = cam.getWorldPoint(pointer.x, pointer.y);
  cam.setZoom(newZoom);
  const worldAfter = cam.getWorldPoint(pointer.x, pointer.y);
  cam.scrollX += worldBefore.x - worldAfter.x;
  cam.scrollY += worldBefore.y - worldAfter.y;

  // 恢复 bounds（Phaser 自动钳制 scroll 到有效范围）
  cam.setBounds(0, 0, mapPixelW, mapPixelH);
});
```

#### 2.3 resize handler 调整

当前 resize handler 会重置 zoom 到 fitZoom 并居中。应改为：仅更新 `MIN_ZOOM` 为新 fitZoom，不重置当前 zoom（除非当前 zoom 小于新的 MIN_ZOOM）。

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `frontend/src/game/types.ts` | AgentVisual 接口：body→Sprite，移除 dirDot/nameText 字段 |
| `frontend/src/game/AgentSpriteFactory.ts` | 重写：atlas 加载、Sprite 创建、动画定义/播放、syncPosition 简化 |
| `frontend/src/game/OfficeScene.ts` | preload 加 atlas、create 移除 dirDot/nameText 定位、修复 wheel handler、调整 resize handler |
| `frontend/src/game/RandomWalker.ts` | 无直接改动（间接通过 syncPosition 受益） |

## 不变的组件

- `PhaserGame.tsx` — React 集成层不变
- `stores/` — 状态管理不变
- `src/types.ts` — AgentDirection / AgentAnimationState 不变
- `RandomWalker` — 碰撞和路径逻辑不变
- 气泡系统 — thinking bubble 保持现有行为
- 点击交互 — Sprite 保留 setInteractive
