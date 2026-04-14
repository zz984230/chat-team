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
      activeSession: state.activeSession?.id === sessionId ? updater(state.activeSession!) : state.activeSession,
      sessions: state.sessions.map((s) => (s.id === sessionId ? updater(s) : s)),
    }));
  },
}));
