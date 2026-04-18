# Virtual Office 布局重设计

**日期**: 2026-04-18
**状态**: 已批准

## 概述

将前端从 4 房间分角色布局改为"Virtual Office"公司办公室风格。采用十字走廊布局，研发部为主房间（4 人围坐圆桌），另有两个纯装饰的"装修中"房间。

## 地图布局

**尺寸**: 24×20 tile（32px/tile），世界尺寸 768×640px。

**3 个房间**:

| 房间 | ID | 位置 | 尺寸(tile) | 状态 |
|------|----|------|-----------|------|
| 研发部 | rd | 上方居中 | 10×8 | 活跃 |
| 市场部 | marketing | 左下方 | 8×6 | 装修中 |
| 财务部 | finance | 右下方 | 8×6 | 装修中 |

**走廊**: T 形走廊连通三室。垂直走廊从研发部向下延伸，水平走廊左右分叉连接市场部和财务部。

**装修中房间**: 虚线边框、暗色调，被布盖住的家具，"装修中"标牌，不可交互。

**研发部内部**: 中央圆桌，4 个 agent 座位分布在四周，白板、屏幕等办公家具。

## 智能体角色

| agentId | 角色名 | 精灵 | 座位(相对圆桌) |
|---------|--------|------|---------------|
| analyst | 需求分析师 | f1 | 上方 |
| architect | 方案架构师 | f4 | 右方 |
| dev-lead | 开发负责人 | f6 | 下方 |
| test-lead | 测试负责人 | f3 | 左方 |

### 后端变更

- `vault/agents/writer.yaml` → 重命名为 `vault/agents/test-lead.yaml`，更新 id、system_prompt、casual_prompt、output_file（测试相关文档）
- 新增 `vault/agents/dev-lead.yaml`，模型 claude-sonnet-4-20250514，输出开发任务分解文档
- analyst.yaml 和 architect.yaml 不变
- default 工作流从 3 阶段调整为 4 阶段：analyst → architect → dev-lead → test-lead
- brainstorm 模式不变

## 前端组件变更

### mapConfig.ts

- 删除旧 4 房间定义（meeting/design/writing/archive）
- 新增 3 房间定义（rd/marketing/finance）
- `RoomDef` 接口新增 `status: "active" | "renovating"` 字段
- 新增 `round_table` 和 `covered` 家具类型
- 研发部 furniture: 圆桌、4 把椅子、白板、屏幕
- 装修中房间 furniture: covered 类型（布盖家具）

### agentConfig.ts

- 删除 writer，新增 dev-lead 和 test-lead
- 所有 agent 的 room 统一为 "rd"
- position/homePosition 对应圆桌四周座位

### OfficeMap.tsx

- 新增 `drawRoundTable()`: 椭圆 + 木纹色 + 高光
- 新增 `drawCoveredFurniture()`: 灰色矩形 + 波浪布纹
- 装修中房间: 虚线墙壁 + "装修中" 标牌 + 半透明遮罩
- 走廊: T 形区域，暖色地板
- 点击检测: 只有 rd 房间可交互
- "Virtual Office" 标题显示在地图顶部

### AgentSprite.tsx

- 无结构性变更，新增 dev-lead 精灵缓存键

### PixiCanvas.tsx

- worldWidth/worldHeight 调整为 768×640

### 不变的组件

StatusBar、AgentDetailPanel、DocViewer、ArchiveDrawer（通过 StatusBar 按钮访问，不依赖地图房间点击）、FlyingDocument、CelebrationEffect — 通过 store 数据驱动，不依赖具体地图布局。

## 数据流

- default 模式 4 阶段: analyst(需求分析) → architect(方案设计) → dev-lead(开发任务分解) → test-lead(测试计划)
- 每阶段通过 AgentPool 调度，输出 markdown 到 vault
- 后续阶段接收前序所有阶段输出文件作为上下文
- WebSocket 事件结构不变，sessionStore 自动适配 4 阶段

## 测试影响

- `test_models.py` — 更新 default 工作流阶段数和 agent 名
- `test_workflow.py` — 更新阶段执行顺序断言
- `test_api.py` — 更新 session 创建后阶段验证
- 前端测试自动适配配置改动
