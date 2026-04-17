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

async function requestVoid(url: string, options?: RequestInit): Promise<void> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
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

  deleteSession: (id: string) =>
    requestVoid(`/api/sessions/${id}`, { method: 'DELETE' }),

  listAgents: () => request<AgentDefinition[]>('/api/agents'),

  getAgent: (id: string) => request<AgentDefinition>(`/api/agents/${id}`),
};
