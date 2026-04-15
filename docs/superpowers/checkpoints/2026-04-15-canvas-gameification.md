# Canvas 游戏化改造 Checkpoint

**日期**: 2026-04-15
**分支**: develop
**HEAD**: 4c044b1

---

## 已完成

| Task | 描述 | Commit |
|------|------|--------|
| Task 1 | 下载 AI Town 精灵图资源 (32x32folk.png + 帧数据替换) | 257464d |
| Task 2 | 扩展 agentStore (direction, targetPosition, room) | cebee3a |
| Task 3 | 扩展数据配置 (mapConfig 家具 + agentConfig 动画参数) | 8487c55 |
| Task 4 | 重写 PixiCanvas 集成 pixi-viewport | 4c044b1 |

## 待完成

| Task | 描述 | 依赖 |
|------|------|------|
| Task 5 | 重写 OfficeMap 程序化渲染 | Task 4 ✅ |
| Task 6 | 重写 AgentSprite 精灵动画 (最复杂) | Task 4 ✅ |
| Task 7 | 新增 FlyingDocument 飞行动画 | Task 4 ✅ |
| Task 8 | 集成所有组件 + Celebration 特效 | Task 5, 6, 7 |
| Task 9 | 最终修复和验证 | Task 8 |

## 关键文件

### 设计文档
- `docs/superpowers/specs/2026-04-15-canvas-gameification-design.md` — 完整设计 spec
- `docs/superpowers/plans/2026-04-15-canvas-gameification.md` — 9-task 实施计划

### 已修改/新增的前端文件
- `frontend/public/assets/32x32folk.png` — AI Town 共享精灵图 (384x256, MIT)
- `frontend/src/data/spritesheets/f1.ts, f3.ts, f4.ts, f6.ts` — 32x32 帧数据 (已更新)
- `frontend/src/data/agentConfig.ts` — 新增 homePosition, animationSpeed
- `frontend/src/data/mapConfig.ts` — 新增 FurnitureItem, floorColor, furniture 数组
- `frontend/src/types.ts` — 新增 AgentDirection 类型
- `frontend/src/stores/agentStore.ts` — 新增 direction, targetPosition, room 字段
- `frontend/src/components/canvas/PixiCanvas.tsx` — 重写：半命令式 + pixi-viewport + ViewportContext

### 需要重写/新增的文件 (Task 5-9)
- `frontend/src/components/canvas/OfficeMap.tsx` — 当前用 @pixi/react 声明式，需改为命令式
- `frontend/src/components/canvas/AgentSprite.tsx` — 同上，最复杂的组件
- `frontend/src/components/canvas/FlyingDocument.tsx` — 新增
- `frontend/src/components/canvas/CelebrationEffect.tsx` — 新增
- `frontend/src/App.tsx` — 需更新 import 和组件组合

## 架构要点

**半命令式 PixiJS 架构：**
- `PixiCanvas` 使用 @pixi/react 的 `Stage` 管理画布
- `ViewportLayer` 命令式创建 `pixi-viewport` 实例
- 子组件通过 `useViewport()` 获取 viewport 引用
- 子组件返回 `null`，通过 useEffect 命令式添加 PixiJS 对象到 viewport
- Zustand store 驱动动画状态，组件 subscribe store 变化

**Spritesheet 加载方式：**
- 所有角色共享 `32x32folk.png`，通过不同帧坐标区分
- Spritesheet 需在 AgentSprite 中用 `new Spritesheet(baseTexture, data)` 加载
- 需要先加载 PNG 为 BaseTexture，再创建 Spritesheet 并 parse

**已知的 Task 6 注意事项：**
- `updateAnimation` 函数中的方向切换需要根据 spritesheet.animations 的实际解析结果实现
- 移动动画用 requestAnimationFrame 驱动 lerp
- ThinkingBubble 集成在 AgentSprite 中（不是独立组件）

## 恢复执行指令

继续执行时，告诉 Claude：
1. "继续 canvas 游戏化改造，从 Task 5 开始"
2. 参考 checkpoint 文件：`docs/superpowers/checkpoints/2026-04-15-canvas-gameification.md`
3. 实施计划：`docs/superpowers/plans/2026-04-15-canvas-gameification.md`
