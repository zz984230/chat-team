# Session 创建时 Agent 复位设计

**日期**: 2026-04-19
**状态**: 待实现

## 概述

当用户提交任务后，所有 agent 立即回到座位。任务执行过程中，未完成的 agent 留在座位并显示思考气泡，完成的 agent 离开座位自由行走。

## 背景

已有的 WebSocket 事件驱动逻辑覆盖了大部分行为：
- `agent:thinking`/`agent:working` → walker 回到座位，停止行走
- `agent:completed` → walker 回到 idle，开始自由行走
- 思考气泡由 `updateBubble` 处理

唯一缺失：session 创建时（后端尚未开始处理前），没有机制让所有 agent 立即回到座位。

## 设计

### 1. OfficeScene 添加 resetAllAgents() 方法

```typescript
resetAllAgents() {
  for (const walker of this.walkers.values()) {
    walker.returnToSeat();
    walker.setAgentState('idle');
  }
  for (const [agentId, visual] of this.agents) {
    playAnimation(visual, 'idle', 'down');
    updateBubble(visual, null);
  }
}
```

遍历所有 walker 强制回到座位，清除气泡。

### 2. RandomWalker 暴露 returnToSeat 为 public

当前 `returnToSeat()` 是 private，需要改为 public 让 OfficeScene 可以调用。

### 3. PhaserGame 监听 session 创建

在 PhaserGame 的 useEffect 中，检测 `sessionStore.activeSession` 变化。当新 session 创建时（status 为 'running' 或 'created'），调用 `scene.resetAllAgents()`。

## 文件变更清单

| 文件 | 改动 |
|------|------|
| `frontend/src/game/OfficeScene.ts` | 添加 `resetAllAgents()` 方法 |
| `frontend/src/game/RandomWalker.ts` | `returnToSeat()` 改为 public |
| `frontend/src/components/canvas/PhaserGame.tsx` | 监听 session 变化，调用 resetAllAgents |
