import { create } from 'zustand';
import type { AgentAnimationState, AgentDirection, WsEvent } from '../types';

interface AgentVisualState {
  animationState: AgentAnimationState;
  thinkingContent: string | null;
  currentTool: string | null;
  outputFiles: string[];
  lastDurationMs: number | null;
  errorMessage: string | null;
  direction: AgentDirection;
  targetPosition: { x: number; y: number } | null;
  room: string | null;
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
  direction: 'down',
  targetPosition: null,
  room: null,
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
              thinkingContent: event.tool ? `使用 ${event.tool}` : null,
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
              targetPosition: null,
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
