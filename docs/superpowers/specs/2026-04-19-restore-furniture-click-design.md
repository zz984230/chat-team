# 恢复桌子和档案柜点击功能设计

**日期**: 2026-04-19
**状态**: 待实现

## 概述

Phaser 3 迁移时丢失了桌子和档案柜的点击交互功能。需要恢复这两个交互：
- 点击图书馆中间桌子 → 打开任务提交弹窗
- 点击上方墙的档案柜 → 打开档案抽屉

## 背景

原始实现在 PixiJS 版本的 `OfficeMap.tsx` 中（commit `8de2a87`），被 Phaser 3 迁移（commit `1d11ce3`）删除。UI store 中的 `openRoomArchive` 和 `openNewTaskModal` 函数仍然存在且可用。

## 设计

### 1. OfficeScene.ts 添加交互区域

在 `create()` 中，创建两个不可见的 Phaser Zone 作为点击区域：

- **档案柜区域**：位于图书馆顶部墙壁，点击触发 `onRoomClick('archive')`
- **桌子区域**：位于图书馆中间碰撞区域（cols 2-3, rows 3-5），点击触发 `onRoomClick('task')`

使用 `scene.add.zone(x, y, width, height)` 创建矩形交互区域，设置 `setInteractive({ useHandCursor: true })`。

### 2. 区分点击和拖拽

当前 `pointerdown` 事件用于相机拖拽。需要区分点击（移动距离小）和拖拽（移动距离大）：

- `pointerdown` 记录起始位置
- `pointerup` 检查移动距离，若 < 5px 则视为点击
- Zone 的 `pointerdown` 事件在拖拽判定为点击时才触发回调

### 3. PhaserGame.tsx 实现 onRoomClick

将当前的空回调 `(_zone: string) => {}` 替换为：

```typescript
onRoomClick: (zone: string) => {
  if (zone === 'archive') {
    useUiStore.getState().openRoomArchive('rd');
  } else if (zone === 'task') {
    useUiStore.getState().openNewTaskModal('rd');
  }
},
```

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `frontend/src/game/OfficeScene.ts` | 添加桌子/档案柜 Zone，修改拖拽逻辑区分点击 |
| `frontend/src/components/canvas/PhaserGame.tsx` | 实现 onRoomClick 回调 |
