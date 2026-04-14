# AgentOffice 前端设计文档 — 第二阶段

**日期**: 2026-04-14
**状态**: Approved
**范围**: 游戏化沉浸式前端 — 办公室俯视图 + PixiJS 渲染 + HTML Overlay

---

## 1. 概述

AgentOffice 前端是一个游戏化沉浸式界面，用户以俯视视角观察一个虚拟办公室中多个 AI Agent 协作处理需求的全过程。采用 PixiJS Canvas 渲染办公室场景和角色动画，HTML Overlay 处理文字输入和文档查看等 UI 交互。

### 1.1 核心定位

**游戏化沉浸体验**：以 AI Town 风格为主，像素风办公室地图、Agent 角色在地图上活动、实时观察工作过程。管理功能通过场景内交互完成（档案柜查看历史、点击角色查看详情）。

### 1.2 核心决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 架构模式 | PixiJS Canvas + HTML Overlay | Canvas 专注游戏渲染，HTML 处理文字交互，职责清晰 |
| UI 框架 | React 18 | 与 @pixi/react 生态成熟，社区大 |
| 渲染引擎 | PixiJS 7.x + @pixi/react | AI Town 验证过的方案，角色动画系统可直接复用 |
| 视口控制 | pixi-viewport | 拖拽、缩放、惯性、缩放限制开箱即用 |
| 状态管理 | Zustand | 轻量，PixiJS ↔ React 桥接简单 |
| 样式方案 | Tailwind CSS | 快速构建 HTML Overlay 组件样式 |
| 构建工具 | Vite | 快速 HMR，PixiJS 资源处理方便 |
| 素材来源 | AI Town MIT 角色 + 自制办公室 tileset | 角色动画直接复用，只需制作地图瓦片 |

### 1.3 不在范围内

- 多用户认证/权限系统
- 自定义工作流编辑器（拖拽编排 Agent）
- 向量搜索/知识库可视化
- 移动端适配
- PWA/离线支持

---

## 2. 视觉风格

### 2.1 办公室俯视图

像素风格 32x32 瓦片地图，俯视 45° 视角。办公室包含 4 个功能区域：

| 区域 | 对应工作流 | Agent | 描述 |
|------|-----------|-------|------|
| 会议室 | Phase 1 — 需求分析 | analyst | 会议桌、白板、投影屏幕 |
| 设计中心 | Phase 2 — 方案设计 | architect + researcher | 双工位、大屏幕、白板墙 |
| 撰写区 | Phase 3 — 整合输出 | writer | 安静角落、书架、单人桌 |
| 档案柜 | 公共区域 | — | 文件柜、公告板、产出展示 |

房间之间由走廊连接，Agent 在不同工作阶段会移动到对应房间。

### 2.2 Agent 动画状态

4 种动画状态，对应不同工作阶段：

| 状态 | 触发条件 | 动画 |
|------|---------|------|
| `idle` | 无任务/等待中 | 静止呼吸动画，小幅上下浮动 |
| `walking` | 进入/离开房间 | 四方向行走动画（SpriteSheet 帧） |
| `working` | `agent:working` 事件 | 打字/操作动画，面向电脑/白板 |
| `thinking` | `agent:thinking` 事件 | working 姿态 + 头顶思考气泡 |

### 2.3 素材来源

- **角色 SpriteSheet**：直接从 AI Town (`data/spritesheets/f1-f8.ts`) 选取 4 个角色
  - analyst → f1 (Lucky 风格)
  - architect → f4 (Bob 风格)
  - researcher → f6 (Stella 风格)
  - writer → f3 (Alice 风格)
- **UI SVG 素材**：复用 AI Town `assets/ui/` 下的气泡、按钮等
- **办公室 tileset**：需要新制，使用 Tiled Editor 设计，规格 32x32 像素
  - 可从 [itch.io CC0 tileset 合集](https://itch.io/c/3621170/cc0-tilesets) 获取免费室内素材
  - 或用 AI 生成像素风办公室素材

---

## 3. 架构

### 3.1 三层架构

```
┌─────────────────────────────────────────────┐
│  Layer 3: 状态管理 (Zustand + WebSocket)      │
│  sessionStore / agentStore / uiStore          │
├─────────────────────────────────────────────┤
│  Layer 2: HTML Overlay (React + Tailwind)     │
│  对话框 / 详情面板 / 文档查看器 / 状态栏       │
├─────────────────────────────────────────────┤
│  Layer 1: PixiJS Canvas (@pixi/react)         │
│  办公室地图 / Agent Sprite / 动画特效          │
└─────────────────────────────────────────────┘
```

- **Layer 1 (PixiJS Canvas)**：全屏 Canvas 渲染办公室瓦片地图、Agent 角色 Sprite、思考气泡、文件飞行动画、视口拖拽缩放
- **Layer 2 (HTML Overlay)**：绝对定位浮在 Canvas 上方，处理需要文字交互的 UI（新任务输入框、文档查看器、Agent 详情面板、历史 Session 列表）
- **Layer 3 (状态管理)**：Zustand stores 管理全局状态，WebSocket 接收后端实时事件更新 store，PixiJS 组件通过 Zustand selector 响应变化驱动动画

### 3.2 数据流

```
后端 FastAPI
  ├── REST API ──────────→ api.ts (services/) ──→ Zustand stores ──→ React 组件
  │                       POST /api/sessions
  │                       GET  /api/sessions/{id}/outputs/{file}
  │
  └── WebSocket ─────────→ useWebSocket hook ──→ Zustand stores ──→ PixiJS 动画
                          WS /api/ws/sessions/{id}
                          agent:thinking / agent:working / agent:completed ...
```

### 3.3 WebSocket 事件 → 视觉映射

| WS 事件 | Canvas 动画 | HTML Overlay |
|---------|------------|-------------|
| `phase:started` | Agent 走向对应房间 | 底部状态栏更新阶段信息 |
| `agent:thinking` | thinking 姿态 + 思考气泡 | 气泡内显示文本片段 |
| `agent:working` | 打字/操作动画 | 工具名提示 |
| `agent:output` | 文件图标飞向档案柜 | 产出文件列表更新 |
| `agent:completed` | 完成光效 + 回到 idle | Agent 详情面板更新 |
| `phase:completed` | 阶段完成指示器 | 进度条推进 |
| `session:completed` | 全场景庆祝动画 | 弹出"查看最终方案" |
| `session:failed` | 红色闪烁 | 错误提示 |

---

## 4. 交互设计

### 4.1 提交新任务

1. 用户点击底部工具栏的"新任务"按钮
2. 场景上方弹出模态对话框（HTML Overlay）
3. 输入需求文本，选择工作流模式（default / brainstorm）
4. 提交 → `POST /api/sessions` → 工作流启动
5. Agent 角色从 idle 状态切换到工作状态，开始 Phase 1

### 4.2 观察 Agent 工作

- Agent 按工作流阶段自动移动到对应房间
- 实时 WebSocket 推送驱动动画（thinking 气泡、working 动作）
- Phase 2 时两个 Agent 在设计中心并行工作
- 产出文件以飞行动画方式归档到档案柜

### 4.3 点击查看 Agent 详情

- 点击地图上的 Agent 角色 → 右侧滑出详情面板（HTML Overlay）
- 显示：Agent 名称、角色描述、当前状态、思考内容片段、已产出文件列表
- 面板可收起

### 4.4 查看产出文档

- 点击档案柜房间 → 弹出文档列表（HTML Overlay）
- 选择文件 → 全屏 Markdown 文档查看器
- 支持查看历史 Session 的文档

### 4.5 查看历史 Session

- 点击公告板/档案柜的"历史记录"标签 → 展开历史 Session 列表
- 列表显示 Session ID、时间、状态、模式
- 点击进入历史 Session 的文档查看模式（只读）

### 4.6 视角控制

- 拖拽：鼠标拖拽平移视口（pixi-viewport drag 插件）
- 缩放：鼠标滚轮缩放（pixi-viewport wheel 插件）
- 惯性：松手后自然减速（pixi-viewport decelerate 插件）
- 缩放限制：最小看到完整办公室，最大 3x 放大

---

## 5. 目录结构

```
frontend/
├── public/
│   └── assets/
│       ├── tilesets/              # 办公室瓦片图 (PNG)
│       ├── spritesheets/          # 角色 SpriteSheet (PNG, 来自 AI Town)
│       ├── ui/                    # UI 图标/装饰 (SVG)
│       └── maps/                  # Tiled 导出的 JSON 地图
├── src/
│   ├── main.tsx                   # 入口
│   ├── App.tsx                    # 根组件：Canvas + Overlay 布局
│   ├── components/
│   │   ├── canvas/                # PixiJS 渲染层
│   │   │   ├── PixiCanvas.tsx     # Stage + Viewport 初始化
│   │   │   ├── OfficeMap.tsx      # 办公室瓦片地图渲染
│   │   │   ├── AgentSprite.tsx    # Agent 角色 Sprite 动画
│   │   │   ├── ThinkingBubble.tsx # 思考气泡特效
│   │   │   └── FlyingDocument.tsx # 文件飞行动画
│   │   ├── overlay/               # HTML 覆盖层
│   │   │   ├── NewTaskModal.tsx   # 新任务对话框
│   │   │   ├── AgentDetailPanel.tsx # Agent 详情侧滑面板
│   │   │   ├── DocViewer.tsx      # Markdown 文档查看器
│   │   │   ├── ArchiveDrawer.tsx  # 历史会话列表
│   │   │   └── StatusBar.tsx      # 底部 Session 状态栏
│   │   └── ui/                    # 通用 UI 组件 (Button, Modal 等)
│   ├── hooks/
│   │   ├── useWebSocket.ts        # WebSocket 连接 + 事件分发
│   │   ├── useSession.ts          # Session CRUD + 状态查询
│   │   └── useAgentAnimation.ts   # WS 事件 → 动画状态映射
│   ├── stores/
│   │   ├── sessionStore.ts        # Session/Phase 状态
│   │   ├── agentStore.ts          # Agent 状态/位置/动画
│   │   └── uiStore.ts             # UI 开关 (modal/panel)
│   ├── services/
│   │   └── api.ts                 # REST API 封装
│   └── data/
│       ├── mapConfig.ts           # 地图房间/区域定义
│       ├── agentConfig.ts         # Agent → SpriteSheet 映射
│       └── spritesheets/          # SpriteSheet JSON 数据
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 6. 从 AI Town 复用的代码

### 6.1 直接复用（改适配层）

| 组件 | AI Town 源文件 | 改动 |
|------|---------------|------|
| 视口组件 | `PixiViewport.tsx` | 改为函数组件，去掉 Convex 依赖 |
| 角色动画 | `Character.tsx` | 保留 SpriteSheet 加载和动画状态机核心逻辑 |
| 角色 Sprite 数据 | `data/spritesheets/f1-f8.ts` | 选取 4 个角色的数据直接使用 |
| UI SVG 素材 | `assets/ui/*.svg` | 气泡、按钮等直接复用 |

### 6.2 借鉴思路重写

| 组件 | AI Town 源文件 | 改动原因 |
|------|---------------|---------|
| 地图渲染 | `PixiStaticMap.tsx` | 从户外自然风光改为办公室瓦片地图 |
| 游戏主组件 | `PixiGame.tsx` | 去掉 Convex 依赖，接入 Zustand 状态 |
| 玩家组件 | `Player.tsx` | 简化为 4 Agent，不需要实时寻路和历史位置回放 |
| 数据层 | Convex hooks | 替换为 REST API + WebSocket |

---

## 7. 技术栈版本

| 依赖 | 版本 | 用途 |
|------|------|------|
| react | 18.x | UI 框架 |
| @pixi/react | latest | PixiJS React 桥接 |
| pixi.js | 7.x | 2D 渲染引擎 |
| pixi-viewport | latest | 视口拖拽缩放 |
| zustand | latest | 状态管理 |
| tailwindcss | 3.x | 样式 |
| vite | latest | 构建工具 |
| typescript | 5.x | 类型安全 |
| react-markdown | latest | Markdown 文档渲染 |
| ky | latest | HTTP 请求（轻量 fetch wrapper） |

---

## 8. 与后端的接口约定

前端通过以下接口与后端通信，无需了解后端内部实现：

- **REST API**：所有数据通过 `/api/sessions`、`/api/agents` 等端点获取
- **WebSocket**：实时状态通过 `WS /api/ws/sessions/{id}` 推送
- **无直接文件系统访问**：文档内容通过 `GET /api/sessions/{id}/outputs/{file}` 获取
