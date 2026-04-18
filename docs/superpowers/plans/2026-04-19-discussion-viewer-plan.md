# 讨论记录彩色卡片分组展示 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 DocViewer 中检测讨论记录文件时，按人员分组渲染彩色卡片，替代纯 markdown 平铺展示。

**Architecture:** 在 DocViewer.tsx 中新增 `parseDiscussion` 解析函数和 `DiscussionCards` 渲染组件。根据文件名判断是否使用自定义渲染。解析器按正则拆分发言，按 agent_id 分组后传给卡片组件。

**Tech Stack:** React, TypeScript, TailwindCSS, ReactMarkdown (已有依赖)

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `frontend/src/components/overlay/DocViewer.tsx` | 修改 | 添加讨论记录解析+卡片渲染逻辑 |
| `frontend/tests/components/DocViewer.test.tsx` | 创建 | 解析函数和组件渲染测试 |

---

### Task 1: 解析函数 `parseDiscussion`

**Files:**
- Create: `frontend/tests/components/DocViewer.test.tsx`
- Modify: `frontend/src/components/overlay/DocViewer.tsx`

- [ ] **Step 1: 写解析函数的失败测试**

创建 `frontend/tests/components/DocViewer.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest';
import { parseDiscussion } from '../../src/components/overlay/DocViewer';

describe('parseDiscussion', () => {
  it('extracts requirement and groups turns by agent', () => {
    const markdown = [
      '# 讨论记录\n',
      '## 原始需求\n用户要做一个聊天系统\n',
      '## analyst（第1轮）\n需要先分析用户群体\n',
      '## architect（第1轮）\n建议用 WebSocket\n',
      '## analyst（第2轮）\n补充：还要考虑移动端\n',
    ].join('\n');

    const result = parseDiscussion(markdown);

    expect(result.requirement).toBe('用户要做一个聊天系统');
    expect(result.agents).toEqual([
      {
        id: 'analyst',
        turns: [
          { round: 1, content: '需要先分析用户群体' },
          { round: 2, content: '补充：还要考虑移动端' },
        ],
      },
      {
        id: 'architect',
        turns: [
          { round: 1, content: '建议用 WebSocket' },
        ],
      },
    ]);
  });

  it('returns empty agents for non-discussion markdown', () => {
    const result = parseDiscussion('## Some Title\n\nHello');
    expect(result.requirement).toBe('');
    expect(result.agents).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run tests/components/DocViewer.test.tsx`
Expected: FAIL — `parseDiscussion` 未导出

- [ ] **Step 3: 在 DocViewer.tsx 中实现 `parseDiscussion`**

在 `frontend/src/components/overlay/DocViewer.tsx` 文件顶部（import 之后，组件之前）添加类型和函数：

```typescript
export interface DiscussionTurn {
  round: number;
  content: string;
}

export interface AgentDiscussion {
  id: string;
  turns: DiscussionTurn[];
}

export interface ParsedDiscussion {
  requirement: string;
  agents: AgentDiscussion[];
}

export function parseDiscussion(markdown: string): ParsedDiscussion {
  const reqMatch = markdown.match(/## 原始需求\n([\s\S]*?)(?=\n## )/);
  const requirement = reqMatch ? reqMatch[1].trim() : '';

  const turnRegex = /## (.+?)（第(\d+)轮）\n([\s\S]*?)(?=\n## |$)/g;
  const agentMap = new Map<string, DiscussionTurn[]>();
  let match: RegExpExecArray | null;

  while ((match = turnRegex.exec(markdown)) !== null) {
    const agentId = match[1];
    const round = parseInt(match[2], 10);
    const content = match[3].trim();
    const turns = agentMap.get(agentId) ?? [];
    turns.push({ round, content });
    agentMap.set(agentId, turns);
  }

  const agents: AgentDiscussion[] = [];
  for (const [id, turns] of agentMap) {
    turns.sort((a, b) => a.round - b.round);
    agents.push({ id, turns });
  }

  return { requirement, agents };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run tests/components/DocViewer.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/overlay/DocViewer.tsx frontend/tests/components/DocViewer.test.tsx
git commit -m "feat: add parseDiscussion function for grouping brainstorm turns by agent"
```

---

### Task 2: `DiscussionCards` 渲染组件

**Files:**
- Modify: `frontend/src/components/overlay/DocViewer.tsx`
- Modify: `frontend/tests/components/DocViewer.test.tsx`

- [ ] **Step 1: 写 DiscussionCards 的渲染测试**

在 `frontend/tests/components/DocViewer.test.tsx` 末尾追加：

```typescript
import { render, screen } from '@testing-library/react';
import { DiscussionCards } from '../../src/components/overlay/DocViewer';

describe('DiscussionCards', () => {
  it('renders agent cards with colored headers and round content', () => {
    const parsed = {
      requirement: '做一个聊天系统',
      agents: [
        {
          id: 'analyst',
          turns: [
            { round: 1, content: '分析用户群体' },
            { round: 2, content: '补充移动端' },
          ],
        },
        {
          id: 'architect',
          turns: [{ round: 1, content: '用 **WebSocket**' }],
        },
      ],
    };

    render(<DiscussionCards data={parsed} />);

    expect(screen.getByText('原始需求')).toBeInTheDocument();
    expect(screen.getByText('做一个聊天系统')).toBeInTheDocument();
    expect(screen.getByText('analyst')).toBeInTheDocument();
    expect(screen.getByText('architect')).toBeInTheDocument();
    expect(screen.getByText('第1轮')).toBeInTheDocument();
    expect(screen.getByText('第2轮')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run tests/components/DocViewer.test.tsx`
Expected: FAIL — `DiscussionCards` 未导出

- [ ] **Step 3: 实现 DiscussionCards 组件**

在 `DocViewer.tsx` 中 `parseDiscussion` 函数之后添加：

```typescript
const AGENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  analyst: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  architect: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  'dev-lead': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
  'test-lead': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
};

const DEFAULT_COLORS = { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800' };

export function DiscussionCards({ data }: { data: ParsedDiscussion }) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-500 mb-1">原始需求</h3>
        <p className="text-gray-900">{data.requirement}</p>
      </div>

      {data.agents.map((agent) => {
        const colors = AGENT_COLORS[agent.id] ?? DEFAULT_COLORS;
        return (
          <div key={agent.id} className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
            <div className={`px-4 py-2 font-semibold ${colors.text} border-b ${colors.border}`}>
              {agent.id}
              <span className="ml-2 text-xs opacity-60">{agent.turns.length} 轮发言</span>
            </div>
            <div className="p-4 space-y-4">
              {agent.turns.map((turn) => (
                <div key={turn.round}>
                  <span className={`text-xs font-medium ${colors.text} opacity-70`}>第{turn.round}轮</span>
                  <div className="mt-1 prose prose-sm max-w-none">
                    <ReactMarkdown>{turn.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run tests/components/DocViewer.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/overlay/DocViewer.tsx frontend/tests/components/DocViewer.test.tsx
git commit -m "feat: add DiscussionCards component with agent-colored card layout"
```

---

### Task 3: DocViewer 条件渲染集成

**Files:**
- Modify: `frontend/src/components/overlay/DocViewer.tsx`

- [ ] **Step 1: 修改 DocViewer 组件的条件渲染逻辑**

将 DocViewer 中渲染 markdown 的部分：

```tsx
<ReactMarkdown>{content ?? ''}</ReactMarkdown>
```

替换为：

```tsx
{target.filename === '01-讨论记录.md' && content ? (
  <DiscussionCards data={parseDiscussion(content)} />
) : (
  <ReactMarkdown>{content ?? ''}</ReactMarkdown>
)}
```

- [ ] **Step 2: 运行全部前端测试确认无回归**

Run: `cd frontend && npx vitest run`
Expected: 全部 PASS

- [ ] **Step 3: 启动开发服务器，手动验证**

Run: `cd frontend && npm run dev`

打开浏览器，创建一个头脑风暴任务，完成后在 DocViewer 中点击 `01-讨论记录.md`，确认：
1. 顶部显示原始需求
2. 每个人员一张彩色卡片（analyst=蓝色, architect=紫色, dev-lead=绿色, test-lead=橙色）
3. 同一人员多轮发言合并显示在一张卡片中
4. 点击其他输出文件仍正常显示纯 markdown

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/overlay/DocViewer.tsx
git commit -m "feat: integrate DiscussionCards into DocViewer for brainstorm discussion files"
```

---

## Self-Review

**Spec coverage:**
- 解析 markdown 按人员分组 → Task 1 ✓
- 颜色映射（4 agents + fallback） → Task 2 ✓
- DiscussionCards 组件渲染 → Task 2 ✓
- DocViewer 条件判断 → Task 3 ✓

**Placeholder scan:** 无 TBD/TODO，每步含完整代码。

**Type consistency:** `ParsedDiscussion`、`AgentDiscussion`、`DiscussionTurn` 在 Task 1 定义，Task 2/3 复用，一致。
