# AgentOffice Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a game-style immersive frontend with PixiJS office map, agent sprite animations, and HTML overlay for text interactions.

**Architecture:** Three-layer design — PixiJS Canvas renders the office map and agent sprites, HTML Overlay handles text input and document viewing, Zustand manages state and bridges WebSocket events to both layers. Code reused from AI Town (MIT) for viewport and character animation.

**Tech Stack:** React 18 + TypeScript + PixiJS 7 + @pixi/react + pixi-viewport + Zustand + Tailwind CSS + Vite

---

## File Structure

```
frontend/
├── public/
│   └── assets/
│       ├── tilesets/
│       │   └── office.png              # 办公室瓦片图集 (Task 6 创建占位)
│       ├── spritesheets/
│       │   ├── f1.png                  # analyst 角色 (来自 AI Town)
│       │   ├── f3.png                  # writer 角色
│       │   ├── f4.png                  # architect 角色
│       │   └── f6.png                  # researcher 角色
│       └── maps/
│           └── office.json             # Tiled 导出的地图数据
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types.ts                        # 与后端对齐的 TS 类型
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── PixiCanvas.tsx          # Stage + Viewport 初始化
│   │   │   ├── OfficeMap.tsx           # 瓦片地图渲染
│   │   │   ├── AgentSprite.tsx         # Agent Sprite 动画 (复用 AI Town Character)
│   │   │   └── ThinkingBubble.tsx      # 思考气泡
│   │   ├── overlay/
│   │   │   ├── NewTaskModal.tsx        # 新任务对话框
│   │   │   ├── AgentDetailPanel.tsx    # Agent 详情侧滑
│   │   │   ├── DocViewer.tsx           # 文档查看器
│   │   │   ├── ArchiveDrawer.tsx       # 历史 Session
│   │   │   └── StatusBar.tsx           # 底部状态栏
│   │   └── ui/
│   │       └── Modal.tsx               # 通用模态框
│   ├── hooks/
│   │   ├── useWebSocket.ts             # WebSocket 连接管理
│   │   └── useSession.ts              # Session CRUD hooks
│   ├── stores/
│   │   ├── uiStore.ts                  # UI 开关
│   │   ├── sessionStore.ts             # Session/Phase 状态
│   │   └── agentStore.ts              # Agent 状态/动画
│   ├── services/
│   │   └── api.ts                      # REST API 封装
│   └── data/
│       ├── mapConfig.ts                # 房间/区域坐标定义
│       ├── agentConfig.ts              # Agent → Sprite 映射
│       └── spritesheets/
│           ├── f1.ts                   # analyst spritesheet data
│           ├── f3.ts                   # writer spritesheet data
│           ├── f4.ts                   # architect spritesheet data
│           └── f6.ts                   # researcher spritesheet data
├── tests/
│   ├── stores/
│   │   ├── uiStore.test.ts
│   │   ├── sessionStore.test.ts
│   │   └── agentStore.test.ts
│   ├── services/
│   │   └── api.test.ts
│   └── hooks/
│       └── useSession.test.ts
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

### Task 1: Project Initialization

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/vitest.config.ts`

- [ ] **Step 1: Create frontend directory and initialize Vite project**

```bash
cd /Users/zero/Project/chat-team
mkdir -p frontend/src frontend/public/assets frontend/tests
```

- [ ] **Step 2: Create package.json with all dependencies**

```json
{
  "name": "agentoffice-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@pixi/react": "^7.1.2",
    "ky": "^1.7.5",
    "pixi-viewport": "^5.0.2",
    "pixi.js": "^7.3.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.3",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "happy-dom": "^15.11.7",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.6",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd /Users/zero/Project/chat-team/frontend && npm install`
Expected: Dependencies installed, node_modules created

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AgentOffice</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create vite.config.ts with backend proxy**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        ws: true,
      },
    },
  },
});
```

- [ ] **Step 6: Install @vitejs/plugin-react**

Run: `cd /Users/zero/Project/chat-team/frontend && npm install -D @vitejs/plugin-react`

- [ ] **Step 7: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 8: Create tailwind.config.ts and postcss.config.js**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 9: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
```

- [ ] **Step 10: Create main.tsx and App.tsx**

```typescript
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```typescript
// src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

```typescript
// src/App.tsx
export default function App() {
  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <h1 className="text-white text-2xl">AgentOffice</h1>
    </div>
  );
}
```

- [ ] **Step 11: Verify dev server starts**

Run: `cd /Users/zero/Project/chat-team/frontend && npm run dev`
Expected: Vite dev server running at http://localhost:3000, page shows "AgentOffice"

- [ ] **Step 12: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/
git commit -m "feat(frontend): initialize Vite + React + TypeScript + Tailwind project"
```

---

### Task 2: TypeScript Types (mirror backend models)

**Files:**
- Create: `frontend/src/types.ts`

- [ ] **Step 1: Create types.ts mirroring backend Pydantic models**

```typescript
// src/types.ts

export type SessionStatus = 'created' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type SessionMode = 'default' | 'brainstorm';
export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Phase {
  id: number;
  name: string;
  agents: string[];
  status: PhaseStatus;
  started_at: string | null;
  completed_at: string | null;
  outputs: string[];
}

export interface Session {
  id: string;
  status: SessionStatus;
  mode: SessionMode;
  created_at: string;
  updated_at: string;
  input_requirement: string;
  phases: Phase[];
}

export interface CreateSessionRequest {
  requirement: string;
  mode: SessionMode;
  agents?: string[] | null;
  config?: { rounds: number };
}

export interface AgentDefinition {
  name: string;
  id: string;
  model: string;
  max_turns: number;
  system_prompt: string;
  output_file: string | null;
  output_template: string | null;
}

// WebSocket event types
export type WsEventType =
  | 'session:started'
  | 'session:completed'
  | 'session:failed'
  | 'session:paused'
  | 'session:cancelled'
  | 'phase:started'
  | 'phase:completed'
  | 'phase:failed'
  | 'agent:thinking'
  | 'agent:working'
  | 'agent:output'
  | 'agent:completed'
  | 'agent:failed';

export interface WsEvent {
  type: WsEventType;
  session_id?: string;
  phase?: number;
  agent_id?: string;
  content?: string;
  tool?: string;
  file?: string;
  error?: string;
  outputs?: string[];
  duration_ms?: number;
}

// Agent visual state
export type AgentAnimationState = 'idle' | 'walking' | 'working' | 'thinking';
```

- [ ] **Step 2: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/types.ts
git commit -m "feat(frontend): add TypeScript types mirroring backend models"
```

---

### Task 3: API Service Layer

**Files:**
- Create: `frontend/src/services/api.ts`
- Create: `frontend/tests/services/api.test.ts`

- [ ] **Step 1: Write failing test for api.ts**

```typescript
// tests/services/api.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../../src/services/api';

describe('api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listSessions', () => {
    it('calls GET /api/sessions and returns session list', async () => {
      const mockSessions = [
        { id: 's1', status: 'completed', mode: 'default', phases: [] },
      ];
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSessions),
      } as Response);

      const result = await api.listSessions();
      expect(result).toEqual(mockSessions);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions');
    });
  });

  describe('createSession', () => {
    it('calls POST /api/sessions with correct body', async () => {
      const mockSession = { id: 's2', status: 'running', mode: 'default', phases: [] };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSession),
      } as Response);

      const result = await api.createSession({ requirement: 'test', mode: 'default' });
      expect(result).toEqual(mockSession);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: 'test', mode: 'default' }),
      }));
    });
  });

  describe('getSession', () => {
    it('calls GET /api/sessions/:id', async () => {
      const mockSession = { id: 's1', status: 'completed', phases: [] };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSession),
      } as Response);

      const result = await api.getSession('s1');
      expect(result).toEqual(mockSession);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/s1');
    });
  });

  describe('getOutputFile', () => {
    it('calls GET /api/sessions/:id/outputs/:file and returns content', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ filename: 'doc.md', content: '# Hello' }),
      } as Response);

      const result = await api.getOutputFile('s1', 'doc.md');
      expect(result).toEqual({ filename: 'doc.md', content: '# Hello' });
    });
  });

  describe('listAgents', () => {
    it('calls GET /api/agents', async () => {
      const mockAgents = [{ id: 'analyst', name: '需求分析师' }];
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgents),
      } as Response);

      const result = await api.listAgents();
      expect(result).toEqual(mockAgents);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/zero/Project/chat-team/frontend && npx vitest run tests/services/api.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement api.ts**

```typescript
// src/services/api.ts
import type { Session, CreateSessionRequest, AgentDefinition } from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  listSessions: () => request<Session[]>('/api/sessions'),

  getSession: (id: string) => request<Session>(`/api/sessions/${id}`),

  createSession: (data: CreateSessionRequest) =>
    request<Session>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSessionWorkflow: (id: string) =>
    request<{ session_id: string; status: string; mode: string; phases: unknown[] }>(
      `/api/sessions/${id}/workflow`,
    ),

  listOutputs: (sessionId: string) =>
    request<string[]>(`/api/sessions/${sessionId}/outputs`),

  getOutputFile: (sessionId: string, filename: string) =>
    request<{ filename: string; content: string }>(
      `/api/sessions/${sessionId}/outputs/${filename}`,
    ),

  pauseSession: (id: string) =>
    request<Session>(`/api/sessions/${id}/pause`, { method: 'POST' }),

  resumeSession: (id: string) =>
    request<Session>(`/api/sessions/${id}/resume`, { method: 'POST' }),

  cancelSession: (id: string) =>
    request<Session>(`/api/sessions/${id}/cancel`, { method: 'POST' }),

  listAgents: () => request<AgentDefinition[]>('/api/agents'),

  getAgent: (id: string) => request<AgentDefinition>(`/api/agents/${id}`),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/zero/Project/chat-team/frontend && npx vitest run tests/services/api.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/services/ frontend/tests/services/
git commit -m "feat(frontend): add REST API service layer with tests"
```

---

### Task 4: Zustand Stores

**Files:**
- Create: `frontend/src/stores/uiStore.ts`
- Create: `frontend/src/stores/sessionStore.ts`
- Create: `frontend/src/stores/agentStore.ts`
- Create: `frontend/tests/stores/uiStore.test.ts`
- Create: `frontend/tests/stores/agentStore.test.ts`

- [ ] **Step 1: Write failing test for uiStore**

```typescript
// tests/stores/uiStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../../src/stores/uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      newTaskModalOpen: false,
      agentDetailPanel: null,
      docViewer: null,
      archiveDrawerOpen: false,
    });
  });

  it('opens and closes new task modal', () => {
    const store = useUiStore.getState();
    expect(store.newTaskModalOpen).toBe(false);

    useUiStore.getState().openNewTaskModal();
    expect(useUiStore.getState().newTaskModalOpen).toBe(true);

    useUiStore.getState().closeNewTaskModal();
    expect(useUiStore.getState().newTaskModalOpen).toBe(false);
  });

  it('opens agent detail panel with agent id', () => {
    useUiStore.getState().openAgentDetail('analyst');
    expect(useUiStore.getState().agentDetailPanel).toBe('analyst');

    useUiStore.getState().closeAgentDetail();
    expect(useUiStore.getState().agentDetailPanel).toBeNull();
  });

  it('opens doc viewer with session and filename', () => {
    useUiStore.getState().openDocViewer({ sessionId: 's1', filename: 'doc.md' });
    expect(useUiStore.getState().docViewer).toEqual({ sessionId: 's1', filename: 'doc.md' });

    useUiStore.getState().closeDocViewer();
    expect(useUiStore.getState().docViewer).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/zero/Project/chat-team/frontend && npx vitest run tests/stores/uiStore.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement uiStore**

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand';

interface DocViewerTarget {
  sessionId: string;
  filename: string;
}

interface UiState {
  newTaskModalOpen: boolean;
  agentDetailPanel: string | null;
  docViewer: DocViewerTarget | null;
  archiveDrawerOpen: boolean;

  openNewTaskModal: () => void;
  closeNewTaskModal: () => void;
  openAgentDetail: (agentId: string) => void;
  closeAgentDetail: () => void;
  openDocViewer: (target: DocViewerTarget) => void;
  closeDocViewer: () => void;
  openArchiveDrawer: () => void;
  closeArchiveDrawer: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  newTaskModalOpen: false,
  agentDetailPanel: null,
  docViewer: null,
  archiveDrawerOpen: false,

  openNewTaskModal: () => set({ newTaskModalOpen: true }),
  closeNewTaskModal: () => set({ newTaskModalOpen: false }),
  openAgentDetail: (agentId) => set({ agentDetailPanel: agentId }),
  closeAgentDetail: () => set({ agentDetailPanel: null }),
  openDocViewer: (target) => set({ docViewer: target }),
  closeDocViewer: () => set({ docViewer: null }),
  openArchiveDrawer: () => set({ archiveDrawerOpen: true }),
  closeArchiveDrawer: () => set({ archiveDrawerOpen: false }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/zero/Project/chat-team/frontend && npx vitest run tests/stores/uiStore.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Implement sessionStore**

```typescript
// src/stores/sessionStore.ts
import { create } from 'zustand';
import type { Session, Phase } from '../types';
import { api } from '../services/api';

interface SessionState {
  sessions: Session[];
  activeSession: Session | null;
  loading: boolean;

  fetchSessions: () => Promise<void>;
  fetchSession: (id: string) => Promise<void>;
  createSession: (requirement: string, mode: 'default' | 'brainstorm') => Promise<void>;
  setActiveSession: (session: Session | null) => void;
  updatePhaseFromEvent: (sessionId: string, phaseId: number, status: string, outputs?: string[]) => void;
  setSessionStatus: (sessionId: string, status: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSession: null,
  loading: false,

  fetchSessions: async () => {
    set({ loading: true });
    const sessions = await api.listSessions();
    set({ sessions, loading: false });
  },

  fetchSession: async (id) => {
    const session = await api.getSession(id);
    set({ activeSession: session });
  },

  createSession: async (requirement, mode) => {
    const session = await api.createSession({ requirement, mode });
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSession: session,
    }));
  },

  setActiveSession: (session) => set({ activeSession: session }),

  updatePhaseFromEvent: (sessionId, phaseId, status, outputs) => {
    const session = sessionId === get().activeSession?.id
      ? get().activeSession
      : get().sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const updatedPhases: Phase[] = session.phases.map((p) =>
      p.id === phaseId
        ? { ...p, status: status as Phase['status'], ...(outputs ? { outputs: [...p.outputs, ...outputs] } : {}) }
        : p,
    );
    const updated = { ...session, phases: updatedPhases };

    set((state) => ({
      activeSession: state.activeSession?.id === sessionId ? updated : state.activeSession,
      sessions: state.sessions.map((s) => (s.id === sessionId ? updated : s)),
    }));
  },

  setSessionStatus: (sessionId, status) => {
    const updater = (s: Session) => ({ ...s, status: status as Session['status'] });
    set((state) => ({
      activeSession: state.activeSession?.id === sessionId ? updater(state.activeSession) : state.activeSession,
      sessions: state.sessions.map((s) => (s.id === sessionId ? updater(s) : s)),
    }));
  },
}));
```

- [ ] **Step 6: Write failing test for agentStore**

```typescript
// tests/stores/agentStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentStore } from '../../src/stores/agentStore';

describe('agentStore', () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: {},
    });
  });

  it('updates agent state on thinking event', () => {
    useAgentStore.getState().handleEvent({ type: 'agent:thinking', agent_id: 'analyst', content: '分析需求...' });
    const agent = useAgentStore.getState().agents['analyst'];
    expect(agent).toBeDefined();
    expect(agent?.animationState).toBe('thinking');
    expect(agent?.thinkingContent).toBe('分析需求...');
  });

  it('updates agent state on working event', () => {
    useAgentStore.getState().handleEvent({ type: 'agent:working', agent_id: 'architect', tool: 'Write' });
    const agent = useAgentStore.getState().agents['architect'];
    expect(agent?.animationState).toBe('working');
  });

  it('updates agent state on completed event', () => {
    useAgentStore.getState().handleEvent({ type: 'agent:completed', agent_id: 'analyst', duration_ms: 5000 });
    const agent = useAgentStore.getState().agents['analyst'];
    expect(agent?.animationState).toBe('idle');
  });

  it('appends output file on output event', () => {
    useAgentStore.getState().handleEvent({ type: 'agent:output', agent_id: 'analyst', file: '01-需求澄清.md' });
    const agent = useAgentStore.getState().agents['analyst'];
    expect(agent?.outputFiles).toContain('01-需求澄清.md');
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd /Users/zero/Project/chat-team/frontend && npx vitest run tests/stores/agentStore.test.ts`
Expected: FAIL

- [ ] **Step 8: Implement agentStore**

```typescript
// src/stores/agentStore.ts
import { create } from 'zustand';
import type { AgentAnimationState, WsEvent } from '../types';

interface AgentVisualState {
  animationState: AgentAnimationState;
  thinkingContent: string | null;
  currentTool: string | null;
  outputFiles: string[];
  lastDurationMs: number | null;
  errorMessage: string | null;
}

interface AgentState {
  agents: Record<string, AgentVisualState>;

  handleEvent: (event: WsEvent) => void;
  resetAgent: (agentId: string) => void;
  resetAll: () => void;
}

const defaultAgentState = (): AgentVisualState => ({
  animationState: 'idle',
  thinkingContent: null,
  currentTool: null,
  outputFiles: [],
  lastDurationMs: null,
  errorMessage: null,
});

export const useAgentStore = create<AgentState>((set) => ({
  agents: {},

  handleEvent: (event) => {
    if (!event.agent_id) return;

    const agentId = event.agent_id;

    switch (event.type) {
      case 'agent:thinking':
        set((state) => ({
          agents: {
            ...state.agents,
            [agentId]: {
              ...(state.agents[agentId] ?? defaultAgentState()),
              animationState: 'thinking',
              thinkingContent: event.content ?? null,
            },
          },
        }));
        break;

      case 'agent:working':
        set((state) => ({
          agents: {
            ...state.agents,
            [agentId]: {
              ...(state.agents[agentId] ?? defaultAgentState()),
              animationState: 'working',
              currentTool: event.tool ?? null,
            },
          },
        }));
        break;

      case 'agent:output':
        set((state) => {
          const existing = state.agents[agentId] ?? defaultAgentState();
          return {
            agents: {
              ...state.agents,
              [agentId]: {
                ...existing,
                outputFiles: event.file
                  ? [...existing.outputFiles, event.file]
                  : existing.outputFiles,
              },
            },
          };
        });
        break;

      case 'agent:completed':
        set((state) => ({
          agents: {
            ...state.agents,
            [agentId]: {
              ...(state.agents[agentId] ?? defaultAgentState()),
              animationState: 'idle',
              lastDurationMs: event.duration_ms ?? null,
              thinkingContent: null,
              currentTool: null,
            },
          },
        }));
        break;

      case 'agent:failed':
        set((state) => ({
          agents: {
            ...state.agents,
            [agentId]: {
              ...(state.agents[agentId] ?? defaultAgentState()),
              animationState: 'idle',
              errorMessage: event.error ?? 'Unknown error',
            },
          },
        }));
        break;
    }
  },

  resetAgent: (agentId) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: defaultAgentState(),
      },
    })),

  resetAll: () => set({ agents: {} }),
}));
```

- [ ] **Step 9: Run all store tests**

Run: `cd /Users/zero/Project/chat-team/frontend && npx vitest run tests/stores/`
Expected: All tests PASS (uiStore 3 + agentStore 4)

- [ ] **Step 10: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/stores/ frontend/tests/stores/
git commit -m "feat(frontend): add Zustand stores for session, agent, and UI state"
```

---

### Task 5: WebSocket Hook

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`

- [ ] **Step 1: Implement useWebSocket hook**

```typescript
// src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import type { WsEvent } from '../types';
import { useSessionStore } from '../stores/sessionStore';
import { useAgentStore } from '../stores/agentStore';

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleEvent = useCallback((event: WsEvent) => {
    // Route to agent store
    if (event.type.startsWith('agent:')) {
      useAgentStore.getState().handleEvent(event);
    }

    // Route to session store
    if (event.type.startsWith('session:')) {
      if (sessionId) {
        useSessionStore.getState().setSessionStatus(sessionId, event.type.split(':')[1]);
      }
    }

    if (event.type.startsWith('phase:')) {
      if (sessionId && event.phase != null) {
        useSessionStore.getState().updatePhaseFromEvent(
          sessionId,
          event.phase,
          event.type === 'phase:started' ? 'running' : event.type === 'phase:completed' ? 'completed' : 'failed',
          event.outputs,
        );
      }
    }
  }, [sessionId]);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws/sessions/${sessionId}`,
    );

    ws.onmessage = (e) => {
      try {
        const event: WsEvent = JSON.parse(e.data);
        handleEvent(event);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      // Reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    wsRef.current = ws;
  }, [sessionId, handleEvent]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
```

- [ ] **Step 2: Implement useSession hook**

```typescript
// src/hooks/useSession.ts
import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';

export function useSessionList() {
  const sessions = useSessionStore((s) => s.sessions);
  const loading = useSessionStore((s) => s.loading);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading };
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/hooks/
git commit -m "feat(frontend): add WebSocket and session hooks"
```

---

### Task 6: Data Configuration + Placeholder Assets

**Files:**
- Create: `frontend/src/data/agentConfig.ts`
- Create: `frontend/src/data/mapConfig.ts`
- Create: `frontend/src/data/spritesheets/f1.ts`
- Create: `frontend/src/data/spritesheets/f3.ts`
- Create: `frontend/src/data/spritesheets/f4.ts`
- Create: `frontend/src/data/spritesheets/f6.ts`

- [ ] **Step 1: Create agentConfig.ts — maps agent IDs to sprite info and room positions**

```typescript
// src/data/agentConfig.ts
export interface AgentVisualConfig {
  agentId: string;
  spriteKey: string;
  spriteUrl: string;
  room: string;
  /** Position in room (tile coordinates) */
  position: { x: number; y: number };
}

export const AGENT_CONFIGS: Record<string, AgentVisualConfig> = {
  analyst: {
    agentId: 'analyst',
    spriteKey: 'f1',
    spriteUrl: '/assets/spritesheets/f1.png',
    room: 'meeting',
    position: { x: 5, y: 5 },
  },
  architect: {
    agentId: 'architect',
    spriteKey: 'f4',
    spriteUrl: '/assets/spritesheets/f4.png',
    room: 'design',
    position: { x: 5, y: 4 },
  },
  researcher: {
    agentId: 'researcher',
    spriteKey: 'f6',
    spriteUrl: '/assets/spritesheets/f6.png',
    room: 'design',
    position: { x: 9, y: 4 },
  },
  writer: {
    agentId: 'writer',
    spriteKey: 'f3',
    spriteUrl: '/assets/spritesheets/f3.png',
    room: 'writing',
    position: { x: 5, y: 12 },
  },
};
```

- [ ] **Step 2: Create mapConfig.ts — defines rooms and areas**

```typescript
// src/data/mapConfig.ts
export interface RoomDef {
  id: string;
  name: string;
  phase: number | null; // null = common area
  agents: string[];
  /** Bounding box in tile coordinates */
  bounds: { x: number; y: number; width: number; height: number };
  /** Agent seat positions */
  seats: Record<string, { x: number; y: number }>;
}

export const ROOMS: RoomDef[] = [
  {
    id: 'meeting',
    name: '会议室',
    phase: 1,
    agents: ['analyst'],
    bounds: { x: 0, y: 0, width: 10, height: 8 },
    seats: { analyst: { x: 5, y: 5 } },
  },
  {
    id: 'design',
    name: '设计中心',
    phase: 2,
    agents: ['architect', 'researcher'],
    bounds: { x: 10, y: 0, width: 10, height: 8 },
    seats: { architect: { x: 13, y: 4 }, researcher: { x: 17, y: 4 } },
  },
  {
    id: 'writing',
    name: '撰写区',
    phase: 3,
    agents: ['writer'],
    bounds: { x: 0, y: 8, width: 10, height: 8 },
    seats: { writer: { x: 5, y: 12 } },
  },
  {
    id: 'archive',
    name: '档案柜',
    phase: null,
    agents: [],
    bounds: { x: 10, y: 8, width: 10, height: 8 },
    seats: {},
  },
];

export const MAP_CONFIG = {
  tileWidth: 32,
  tileHeight: 32,
  mapWidth: 20,
  mapHeight: 16,
  corridorColor: 0x4a4a5a,
  roomFloorColor: 0x3a3a4a,
  wallColor: 0x2a2a3a,
};
```

- [ ] **Step 3: Create placeholder spritesheet data files**

Each file exports a standard PixiJS `ISpritesheetData` object. The format matches AI Town's spritesheet structure with 4 directions (left, right, up, down) and 3 animation frames each.

```typescript
// src/data/spritesheets/f1.ts
import type { ISpritesheetData } from 'pixi.js';

export const spritesheetData: ISpritesheetData = {
  frames: {
    'down-0': { frame: { x: 0, y: 0, w: 16, h: 16 } },
    'down-1': { frame: { x: 16, y: 0, w: 16, h: 16 } },
    'down-2': { frame: { x: 32, y: 0, w: 16, h: 16 } },
    'up-0': { frame: { x: 0, y: 16, w: 16, h: 16 } },
    'up-1': { frame: { x: 16, y: 16, w: 16, h: 16 } },
    'up-2': { frame: { x: 32, y: 16, w: 16, h: 16 } },
    'right-0': { frame: { x: 0, y: 32, w: 16, h: 16 } },
    'right-1': { frame: { x: 16, y: 32, w: 16, h: 16 } },
    'right-2': { frame: { x: 32, y: 32, w: 16, h: 16 } },
    'left-0': { frame: { x: 0, y: 48, w: 16, h: 16 } },
    'left-1': { frame: { x: 16, y: 48, w: 16, h: 16 } },
    'left-2': { frame: { x: 32, y: 48, w: 16, h: 16 } },
  },
  animations: {
    'down': ['down-0', 'down-1', 'down-2'],
    'up': ['up-0', 'up-1', 'up-2'],
    'right': ['right-0', 'right-1', 'right-2'],
    'left': ['left-0', 'left-1', 'left-2'],
  },
  meta: {
    scale: '1',
  },
};
```

Create identical structure for `f3.ts`, `f4.ts`, `f6.ts` (same frame layout, different sprite key in agentConfig).

- [ ] **Step 4: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/data/
git commit -m "feat(frontend): add agent config, map config, and placeholder spritesheet data"
```

---

### Task 7: UI Base Components

**Files:**
- Create: `frontend/src/components/ui/Modal.tsx`

- [ ] **Step 1: Create Modal component**

```tsx
// src/components/ui/Modal.tsx
import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function Modal({ open, onClose, children, title }: ModalProps) {
  useEffect(() => {
    if (open) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* Content */}
      <div className="relative bg-gray-800 rounded-xl shadow-2xl border border-gray-700 max-w-lg w-full mx-4 p-6">
        {title && <h2 className="text-white text-lg font-semibold mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/ui/
git commit -m "feat(frontend): add Modal base component"
```

---

### Task 8: PixiJS Canvas + Viewport

**Files:**
- Create: `frontend/src/components/canvas/PixiCanvas.tsx`

This task creates the PixiJS Stage wrapper and integrates `pixi-viewport` for drag/zoom. Based on AI Town's `PixiViewport.tsx` pattern, simplified for our use case.

- [ ] **Step 1: Create PixiCanvas with Viewport**

```tsx
// src/components/canvas/PixiCanvas.tsx
import { useRef, useEffect, useState, type ReactNode } from 'react';
import { Stage, Container, Text } from '@pixi/react';
import { Application, Container as PixiContainer } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { MAP_CONFIG } from '../../data/mapConfig';

interface PixiCanvasProps {
  children?: ReactNode;
}

export function PixiCanvas({ children }: PixiCanvasProps) {
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
      if (viewportRef.current) {
        viewportRef.current.screenWidth = window.innerWidth;
        viewportRef.current.screenHeight = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const worldWidth = MAP_CONFIG.mapWidth * MAP_CONFIG.tileWidth;
  const worldHeight = MAP_CONFIG.mapHeight * MAP_CONFIG.tileHeight;

  return (
    <Stage
      width={dimensions.width}
      height={dimensions.height}
      options={{
        backgroundColor: 0x1a1a2e,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      }}
      onMount={(app) => {
        appRef.current = app;
      }}
    >
      <ViewportWrapper
        screenWidth={dimensions.width}
        screenHeight={dimensions.height}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        onViewportReady={(vp) => {
          viewportRef.current = vp;
        }}
      >
        {children}
      </ViewportWrapper>
    </Stage>
  );
}

// Custom Viewport wrapper using @pixi/react's PixiComponent pattern
function ViewportWrapper({
  screenWidth,
  screenHeight,
  worldWidth,
  worldHeight,
  onViewportReady,
  children,
}: {
  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  onViewportReady: (vp: Viewport) => void;
  children?: ReactNode;
}) {
  const containerRef = useRef<PixiContainer | null>(null);

  useEffect(() => {
    const app = (containerRef.current as unknown as { parent: { parent: Application } } | null)
      ?.parent?.parent;
    if (!app) return;

    const vp = new Viewport({
      events: app.renderer.events,
      screenWidth,
      screenHeight,
      worldWidth,
      worldHeight,
      passiveWheel: false,
    });

    vp.drag().pinch().wheel().decelerate().clamp({ direction: 'all', underflow: 'center' }).setZoom(1);

    containerRef.current!.addChild(vp);
    onViewportReady(vp);

    return () => {
      vp.destroy();
    };
  }, [screenWidth, screenHeight, worldWidth, worldHeight, onViewportReady]);

  return <Container ref={containerRef}>{/* Viewport children rendered inside viewport via imperative API */}</Container>;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/canvas/PixiCanvas.tsx
git commit -m "feat(frontend): add PixiJS Canvas with pixi-viewport integration"
```

---

### Task 9: Office Map Rendering

**Files:**
- Create: `frontend/src/components/canvas/OfficeMap.tsx`

Renders a simple grid-based office using PixiJS Graphics API (colored rectangles for rooms, walls, and corridor). No tileset image dependency — uses programmatic drawing for v1.

- [ ] **Step 1: Implement OfficeMap with Graphics API**

```tsx
// src/components/canvas/OfficeMap.tsx
import { Graphics } from '@pixi/react';
import { useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';

export function OfficeMap() {
  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();

    const { tileWidth, tileHeight, corridorColor, roomFloorColor, wallColor } = MAP_CONFIG;

    // Draw corridor background
    g.beginFill(corridorColor);
    g.drawRect(0, 0, MAP_CONFIG.mapWidth * tileWidth, MAP_CONFIG.mapHeight * tileHeight);
    g.endFill();

    // Draw rooms
    for (const room of ROOMS) {
      const { x, y, width, height } = room.bounds;

      // Floor
      g.beginFill(roomFloorColor);
      g.drawRect(x * tileWidth, y * tileHeight, width * tileWidth, height * tileHeight);
      g.endFill();

      // Walls
      g.lineStyle(3, wallColor, 1);
      g.drawRect(x * tileWidth, y * tileHeight, width * tileWidth, height * tileHeight);

      // Room label
      g.lineStyle(0);
    }
  }, []);

  const drawLabels = useCallback((g: PIXI.Graphics) => {
    g.clear();
    const { tileWidth, tileHeight } = MAP_CONFIG;

    for (const room of ROOMS) {
      const { x, y, width, height } = room.bounds;
      // Draw room name as text inside the room
      const label = new PIXI.Text(room.name, {
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0x888899,
        align: 'center',
      });
      label.anchor.set(0.5);
      label.x = (x + width / 2) * tileWidth;
      label.y = (y + 0.5) * tileHeight;
      g.addChild(label);
    }
  }, []);

  return (
    <>
      <Graphics draw={draw} />
      <Graphics draw={drawLabels} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/canvas/OfficeMap.tsx
git commit -m "feat(frontend): add programmatic office map rendering with Graphics API"
```

---

### Task 10: Agent Sprite Component

**Files:**
- Create: `frontend/src/components/canvas/AgentSprite.tsx`

Based on AI Town's `Character.tsx`. Simplified: no real-time position interpolation, just places agents at their room seats and switches animation based on Zustand state.

- [ ] **Step 1: Implement AgentSprite component**

```tsx
// src/components/canvas/AgentSprite.tsx
import { Container, Graphics, Sprite, Text, AnimatedSprite } from '@pixi/react';
import { useCallback, useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import { AGENT_CONFIGS } from '../../data/agentConfig';
import { MAP_CONFIG } from '../../data/mapConfig';
import { ROOMS } from '../../data/mapConfig';
import { useAgentStore } from '../../stores/agentStore';
import { useUiStore } from '../../stores/uiStore';
import type { AgentAnimationState } from '../../types';

// Simple colored circle as placeholder sprite when no spritesheet loaded
function PlaceholderSprite({
  color,
  x,
  y,
  onClick,
}: {
  color: number;
  x: number;
  y: number;
  onClick: () => void;
}) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      g.beginFill(color);
      g.drawCircle(0, 0, 12);
      g.endFill();
      g.beginFill(0xffffff);
      g.drawCircle(0, -4, 4);
      g.endFill();
      // Click area
      g.hitArea = new PIXI.Circle(0, 0, 16);
    },
    [color],
  );

  return <Graphics draw={draw} x={x} y={y} interactive pointerdown={onClick} />;
}

function AgentLabel({ name, x, y }: { name: string; x: number; y: number }) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      const label = new PIXI.Text(name, {
        fontFamily: 'sans-serif',
        fontSize: 10,
        fill: 0xcccccc,
        align: 'center',
      });
      label.anchor.set(0.5);
      label.x = 0;
      label.y = 20;
      g.addChild(label);
    },
    [name],
  );
  return <Graphics draw={draw} x={x} y={y} />;
}

const AGENT_COLORS: Record<string, number> = {
  analyst: 0x53c28b,
  architect: 0x7eb8da,
  researcher: 0xf0a500,
  writer: 0xc89bda,
};

const AGENT_NAMES: Record<string, string> = {
  analyst: '需求分析师',
  architect: '方案架构师',
  researcher: '资料研究员',
  writer: '方案撰写员',
};

export function AgentSprite({ agentId }: { agentId: string }) {
  const config = AGENT_CONFIGS[agentId];
  const agentState = useAgentStore((s) => s.agents[agentId]);
  const openAgentDetail = useUiStore((s) => s.openAgentDetail);
  const animationState: AgentAnimationState = agentState?.animationState ?? 'idle';

  // Find the room and seat for this agent
  const room = ROOMS.find((r) => r.agents.includes(agentId));
  const seat = room?.seats[agentId] ?? { x: 0, y: 0 };
  const pixelX = seat.x * MAP_CONFIG.tileWidth;
  const pixelY = seat.y * MAP_CONFIG.tileHeight;

  const handleClick = () => {
    openAgentDetail(agentId);
  };

  return (
    <Container>
      <PlaceholderSprite color={AGENT_COLORS[agentId] ?? 0xffffff} x={pixelX} y={pixelY} onClick={handleClick} />
      <AgentLabel name={AGENT_NAMES[agentId] ?? agentId} x={pixelX} y={pixelY} />

      {/* Animation state indicator */}
      {animationState === 'thinking' && (
        <ThinkingIndicator x={pixelX} y={pixelY - 20} content={agentState?.thinkingContent ?? ''} />
      )}
      {animationState === 'working' && (
        <WorkingIndicator x={pixelX} y={pixelY - 20} tool={agentState?.currentTool ?? ''} />
      )}
    </Container>
  );
}

function ThinkingIndicator({ x, y, content }: { x: number; y: number; content: string }) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      // Bubble
      g.beginFill(0x16213e, 0.9);
      g.drawRoundedRect(-40, -20, 80, 24, 6);
      g.endFill();
      g.beginFill(0x16213e, 0.9);
      g.drawPolygon([0, 4, -5, -2, 5, -2]);
      g.endFill();
      // Text (truncated)
      const text = new PIXI.Text(content.length > 12 ? content.slice(0, 12) + '...' : content, {
        fontFamily: 'sans-serif',
        fontSize: 9,
        fill: 0x7eb8da,
      });
      text.anchor.set(0.5);
      text.x = 0;
      text.y = -8;
      g.addChild(text);
    },
    [content],
  );
  return <Graphics draw={draw} x={x} y={y} />;
}

function WorkingIndicator({ x, y, tool }: { x: number; y: number; tool: string }) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      g.beginFill(0x0f3460, 0.9);
      g.drawRoundedRect(-30, -16, 60, 18, 4);
      g.endFill();
      const text = new PIXI.Text(`⚡ ${tool}`, {
        fontFamily: 'sans-serif',
        fontSize: 9,
        fill: 0xf0a500,
      });
      text.anchor.set(0.5);
      text.x = 0;
      text.y = -7;
      g.addChild(text);
    },
    [tool],
  );
  return <Graphics draw={draw} x={x} y={y} />;
}

/** Renders all 4 agent sprites */
export function AllAgentSprites() {
  const agentIds = Object.keys(AGENT_CONFIGS);
  return (
    <>
      {agentIds.map((id) => (
        <AgentSprite key={id} agentId={id} />
      ))}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/canvas/AgentSprite.tsx
git commit -m "feat(frontend): add Agent sprite with animation state indicators"
```

---

### Task 11: Overlay Components — New Task Modal + Status Bar

**Files:**
- Create: `frontend/src/components/overlay/NewTaskModal.tsx`
- Create: `frontend/src/components/overlay/StatusBar.tsx`

- [ ] **Step 1: Implement NewTaskModal**

```tsx
// src/components/overlay/NewTaskModal.tsx
import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import type { SessionMode } from '../../types';

export function NewTaskModal() {
  const open = useUiStore((s) => s.newTaskModalOpen);
  const close = useUiStore((s) => s.closeNewTaskModal);
  const createSession = useSessionStore((s) => s.createSession);

  const [requirement, setRequirement] = useState('');
  const [mode, setMode] = useState<SessionMode>('default');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!requirement.trim()) return;
    setSubmitting(true);
    try {
      await createSession(requirement.trim(), mode);
      setRequirement('');
      setMode('default');
      close();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="提交新需求">
      <textarea
        className="w-full bg-gray-900 text-white rounded-lg p-3 border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
        rows={4}
        placeholder="描述你的需求..."
        value={requirement}
        onChange={(e) => setRequirement(e.target.value)}
      />
      <div className="flex items-center gap-3 mt-4">
        <select
          className="bg-gray-900 text-white rounded-lg px-3 py-2 border border-gray-600"
          value={mode}
          onChange={(e) => setMode(e.target.value as SessionMode)}
        >
          <option value="default">默认模式（四角色流程）</option>
          <option value="brainstorm">头脑风暴</option>
        </select>
        <button
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg disabled:opacity-50"
          disabled={submitting || !requirement.trim()}
          onClick={handleSubmit}
        >
          {submitting ? '启动中...' : '启动'}
        </button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Implement StatusBar**

```tsx
// src/components/overlay/StatusBar.tsx
import { useSessionStore } from '../../stores/sessionStore';
import { useUiStore } from '../../stores/uiStore';

export function StatusBar() {
  const session = useSessionStore((s) => s.activeSession);
  const openNewTask = useUiStore((s) => s.openNewTaskModal);
  const openArchive = useUiStore((s) => s.openArchiveDrawer);

  const phaseLabels = session?.phases.map((p) => `${p.name}: ${p.status}`).join(' → ') ?? '';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-sm border-t border-gray-700 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-xs">
          {session ? (
            <>
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${session.status === 'running' ? 'bg-green-500' : session.status === 'completed' ? 'bg-blue-500' : session.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'}`} />
              Session: {session.id.slice(0, 14)}... | {session.status}
            </>
          ) : (
            '空闲'
          )}
        </span>
        {phaseLabels && <span className="text-gray-500 text-xs">{phaseLabels}</span>}
      </div>
      <div className="flex gap-2">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-md"
          onClick={openNewTask}
        >
          + 新任务
        </button>
        <button
          className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-md"
          onClick={openArchive}
        >
          档案柜
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/overlay/NewTaskModal.tsx frontend/src/components/overlay/StatusBar.tsx
git commit -m "feat(frontend): add NewTaskModal and StatusBar overlay components"
```

---

### Task 12: Overlay Components — Agent Detail Panel + Doc Viewer + Archive

**Files:**
- Create: `frontend/src/components/overlay/AgentDetailPanel.tsx`
- Create: `frontend/src/components/overlay/DocViewer.tsx`
- Create: `frontend/src/components/overlay/ArchiveDrawer.tsx`

- [ ] **Step 1: Implement AgentDetailPanel**

```tsx
// src/components/overlay/AgentDetailPanel.tsx
import { useUiStore } from '../../stores/uiStore';
import { useAgentStore } from '../../stores/agentStore';

const AGENT_NAMES: Record<string, string> = {
  analyst: '需求分析师',
  architect: '方案架构师',
  researcher: '资料研究员',
  writer: '方案撰写员',
};

const AGENT_COLORS: Record<string, string> = {
  analyst: 'text-green-400',
  architect: 'text-blue-400',
  researcher: 'text-yellow-400',
  writer: 'text-purple-400',
};

export function AgentDetailPanel() {
  const agentId = useUiStore((s) => s.agentDetailPanel);
  const close = useUiStore((s) => s.closeAgentDetail);
  const agentState = useAgentStore((s) => (agentId ? s.agents[agentId] : undefined));

  if (!agentId) return null;

  return (
    <div className="fixed top-0 right-0 z-50 h-full w-80 bg-gray-800 border-l border-gray-700 shadow-2xl transform transition-transform duration-300">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${AGENT_COLORS[agentId] ?? 'text-white'}`}>
            {AGENT_NAMES[agentId] ?? agentId}
          </h3>
          <button className="text-gray-400 hover:text-white" onClick={close}>
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <span className="text-gray-500">ID:</span>{' '}
            <span className="text-gray-300">{agentId}</span>
          </div>

          <div>
            <span className="text-gray-500">状态:</span>{' '}
            <span className="text-white">{agentState?.animationState ?? 'idle'}</span>
          </div>

          {agentState?.thinkingContent && (
            <div>
              <span className="text-gray-500">思考内容:</span>
              <p className="text-blue-300 mt-1 text-xs bg-gray-900 rounded p-2 max-h-40 overflow-y-auto">
                {agentState.thinkingContent}
              </p>
            </div>
          )}

          {agentState?.currentTool && (
            <div>
              <span className="text-gray-500">正在使用:</span>{' '}
              <span className="text-yellow-400">{agentState.currentTool}</span>
            </div>
          )}

          {agentState?.outputFiles.length > 0 && (
            <div>
              <span className="text-gray-500">产出文件:</span>
              <ul className="mt-1 space-y-1">
                {agentState.outputFiles.map((f) => (
                  <li key={f} className="text-green-400 text-xs">📄 {f}</li>
                ))}
              </ul>
            </div>
          )}

          {agentState?.errorMessage && (
            <div className="text-red-400 text-xs">错误: {agentState.errorMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement DocViewer**

```tsx
// src/components/overlay/DocViewer.tsx
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useUiStore } from '../../stores/uiStore';
import { api } from '../../services/api';

export function DocViewer() {
  const target = useUiStore((s) => s.docViewer);
  const close = useUiStore((s) => s.closeDocViewer);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!target) {
      setContent(null);
      return;
    }
    setLoading(true);
    api.getOutputFile(target.sessionId, target.filename)
      .then((data) => setContent(data.content))
      .catch(() => setContent('加载失败'))
      .finally(() => setLoading(false));
  }, [target]);

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-white rounded-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-gray-900 font-semibold">{target.filename}</h3>
          <button className="text-gray-400 hover:text-gray-900 text-xl" onClick={close}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 prose prose-sm max-w-none">
          {loading ? (
            <p className="text-gray-400">加载中...</p>
          ) : (
            <ReactMarkdown>{content ?? ''}</ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement ArchiveDrawer**

```tsx
// src/components/overlay/ArchiveDrawer.tsx
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSessionList } from '../../hooks/useSession';

export function ArchiveDrawer() {
  const open = useUiStore((s) => s.archiveDrawerOpen);
  const close = useUiStore((s) => s.closeArchiveDrawer);
  const openDoc = useUiStore((s) => s.openDocViewer);
  const { sessions } = useSessionList();
  const setActive = useSessionStore((s) => s.setActiveSession);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative w-96 bg-gray-800 border-l border-gray-700 h-full overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-semibold">档案柜</h3>
            <button className="text-gray-400 hover:text-white" onClick={close}>✕</button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无历史记录</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-gray-900 rounded-lg p-3 border border-gray-700 cursor-pointer hover:border-gray-500"
                  onClick={() => {
                    setActive(session);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm font-mono">{session.id.slice(0, 18)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      session.status === 'completed' ? 'bg-green-900 text-green-400' :
                      session.status === 'running' ? 'bg-blue-900 text-blue-400' :
                      session.status === 'failed' ? 'bg-red-900 text-red-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{session.input_requirement.slice(0, 60)}...</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {session.phases.flatMap((p) => p.outputs).map((f) => (
                      <button
                        key={f}
                        className="text-xs text-blue-400 hover:text-blue-300 bg-gray-800 px-2 py-0.5 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDoc({ sessionId: session.id, filename: f });
                        }}
                      >
                        📄 {f}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/overlay/AgentDetailPanel.tsx frontend/src/components/overlay/DocViewer.tsx frontend/src/components/overlay/ArchiveDrawer.tsx
git commit -m "feat(frontend): add AgentDetailPanel, DocViewer, and ArchiveDrawer"
```

---

### Task 13: App Integration — Wire Everything Together

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx to integrate all components**

```tsx
// src/App.tsx
import { PixiCanvas } from './components/canvas/PixiCanvas';
import { OfficeMap } from './components/canvas/OfficeMap';
import { AllAgentSprites } from './components/canvas/AgentSprite';
import { NewTaskModal } from './components/overlay/NewTaskModal';
import { StatusBar } from './components/overlay/StatusBar';
import { AgentDetailPanel } from './components/overlay/AgentDetailPanel';
import { DocViewer } from './components/overlay/DocViewer';
import { ArchiveDrawer } from './components/overlay/ArchiveDrawer';
import { useWebSocket } from './hooks/useWebSocket';
import { useSessionStore } from './stores/sessionStore';

function GameScene() {
  return (
    <PixiCanvas>
      <OfficeMap />
      <AllAgentSprites />
    </PixiCanvas>
  );
}

export default function App() {
  const activeSessionId = useSessionStore((s) => s.activeSession?.id ?? null);
  useWebSocket(activeSessionId);

  return (
    <div className="w-full h-full relative">
      {/* Layer 1: PixiJS Canvas */}
      <GameScene />

      {/* Layer 2: HTML Overlays */}
      <NewTaskModal />
      <StatusBar />
      <AgentDetailPanel />
      <DocViewer />
      <ArchiveDrawer />
    </div>
  );
}
```

- [ ] **Step 2: Verify dev server starts and renders**

Run: `cd /Users/zero/Project/chat-team/frontend && npm run dev`
Expected: Vite runs at http://localhost:3000, page shows office map with 4 colored agent circles and bottom status bar

- [ ] **Step 3: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/App.tsx
git commit -m "feat(frontend): wire all components together in App.tsx"
```

---

### Task 14: Room Click Interaction

**Files:**
- Modify: `frontend/src/components/canvas/OfficeMap.tsx`

Add clickable hit areas to rooms. Clicking the archive room opens the archive drawer. Clicking rooms with running agents could zoom/center on that room.

- [ ] **Step 1: Add interactive hit areas to rooms**

Add to `OfficeMap.tsx` — for each room, draw an invisible interactive overlay that opens the archive drawer when the archive room is clicked:

```tsx
// Add to OfficeMap.tsx — a new component for room interaction
import { useUiStore } from '../../stores/uiStore';

function RoomInteractionLayer() {
  const openArchive = useUiStore((s) => s.openArchiveDrawer);

  return (
    <>
      {ROOMS.map((room) => {
        if (room.id !== 'archive') return null;
        const { x, y, width, height } = room.bounds;
        return (
          <InteractiveRoom
            key={room.id}
            x={x * MAP_CONFIG.tileWidth}
            y={y * MAP_CONFIG.tileHeight}
            width={width * MAP_CONFIG.tileWidth}
            height={height * MAP_CONFIG.tileHeight}
            onClick={openArchive}
            tooltip="档案柜"
          />
        );
      })}
    </>
  );
}

function InteractiveRoom({
  x, y, width, height, onClick, tooltip,
}: {
  x: number; y: number; width: number; height: number;
  onClick: () => void; tooltip: string;
}) {
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      g.beginFill(0xffffff, 0.01); // Near-transparent for hit area
      g.drawRect(0, 0, width, height);
      g.endFill();
      g.hitArea = new PIXI.Rectangle(0, 0, width, height);
      g.cursor = 'pointer';
    },
    [width, height],
  );

  return <Graphics draw={draw} x={x} y={y} interactive pointerdown={onClick} />;
}
```

Import and render `<RoomInteractionLayer />` inside `<OfficeMap />`.

- [ ] **Step 2: Commit**

```bash
cd /Users/zero/Project/chat-team
git add frontend/src/components/canvas/OfficeMap.tsx
git commit -m "feat(frontend): add clickable room interaction for archive drawer"
```

---

### Task 15: Run All Tests and Verify

- [ ] **Step 1: Run all tests**

Run: `cd /Users/zero/Project/chat-team/frontend && npx vitest run`
Expected: All tests pass (api 5, uiStore 3, agentStore 4 = 12 tests)

- [ ] **Step 2: Start backend + frontend together**

Terminal 1:
```bash
cd /Users/zero/Project/chat-team/backend && uv run uvicorn app.main:app --port 8000 --reload
```

Terminal 2:
```bash
cd /Users/zero/Project/chat-team/frontend && npm run dev
```

Expected:
- Backend at http://localhost:8000
- Frontend at http://localhost:3000
- Frontend proxies `/api/*` to backend
- Office map renders with 4 agent circles
- Clicking "+ 新任务" opens modal
- Submitting a requirement starts a session (if `claude` CLI available)

- [ ] **Step 3: Final commit**

```bash
cd /Users/zero/Project/chat-team
git add -A frontend/
git commit -m "feat(frontend): complete v1 game-style frontend with PixiJS office map"
```
