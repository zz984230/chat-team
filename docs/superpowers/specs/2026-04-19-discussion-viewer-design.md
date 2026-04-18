# 讨论记录彩色卡片分组展示设计

## 背景

头脑风暴模式生成的讨论记录（`01-讨论记录.md`）目前通过通用 DocViewer 以纯 markdown 渲染。所有人员的发言按时间顺序平铺，没有视觉分隔，难以快速定位某个人的观点。

## 目标

在 DocViewer 中检测讨论记录文件时，使用自定义渲染：按人员分组，每人一个带颜色标识的卡片，卡片内展示该人员的所有轮次发言。

## 改动范围

仅前端，改动文件：
- `frontend/src/components/overlay/DocViewer.tsx` — 主要改动文件

不涉及后端改动。

## 实现细节

### 1. 讨论 markdown 解析

当前后端生成的格式：

```markdown
# 讨论记录

## 原始需求
{需求文本}

## analyst（第1轮）
{发言内容}

## architect（第1轮）
{发言内容}

## analyst（第2轮）
{发言内容}
```

解析逻辑：
- 提取 `## 原始需求` 后的文本作为需求摘要
- 按 `## {agent_id}（第{N}轮）` 正则匹配拆分每条发言
- 按 agent_id 分组，每组内按轮次排序

### 2. 颜色映射

为每个 agent 定义固定的颜色主题：

| Agent | 背景色 | 边框色 | 文字色 |
|-------|--------|--------|--------|
| analyst | blue-50 | blue-200 | blue-800 |
| architect | purple-50 | purple-200 | purple-800 |
| dev-lead | green-50 | green-200 | green-800 |
| test-lead | orange-50 | orange-200 | orange-800 |
| 其他 | gray-50 | gray-200 | gray-800 |

### 3. 组件结构

DocViewer 内部逻辑：

```
target.filename === '01-讨论记录.md'
  ? <DiscussionCards content={content} />
  : <ReactMarkdown>{content}</ReactMarkdown>
```

`DiscussionCards` 渲染结构：

```
<div>
  {/* 原始需求区 */}
  <div class="需求摘要">...</div>

  {/* 每人一张卡片 */}
  <div class="agent-card" style={colors}>
    <div class="card-header">agent 名称 + 发言次数</div>
    <div class="card-body">
      <div class="round-block">
        <span>第N轮</span>
        <ReactMarkdown>内容</ReactMarkdown>
      </div>
      ...
    </div>
  </div>
  ...
</div>
```

### 4. 样式

使用 TailwindCSS 内联类名，不需要额外 CSS 文件。卡片间距用 `space-y-4`，轮次间用分隔线。

## 不做的事

- 不改后端 markdown 格式
- 不新增独立组件文件（逻辑内联在 DocViewer 中）
- 不引入新的依赖库
