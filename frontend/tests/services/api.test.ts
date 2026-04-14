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
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }));
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
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/s1', expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }));
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
