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
