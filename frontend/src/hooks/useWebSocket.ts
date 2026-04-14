// src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import type { WsEvent, SessionStatus } from '../types';
import { useSessionStore } from '../stores/sessionStore';
import { useAgentStore } from '../stores/agentStore';

const SESSION_STATUS_MAP: Record<string, SessionStatus> = {
  'session:started': 'running',
  'session:completed': 'completed',
  'session:failed': 'failed',
  'session:paused': 'paused',
  'session:cancelled': 'cancelled',
};

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  const handleEvent = useCallback((event: WsEvent) => {
    // Route to agent store
    if (event.type.startsWith('agent:')) {
      useAgentStore.getState().handleEvent(event);
    }

    // Route to session store
    if (event.type.startsWith('session:')) {
      if (sessionId) {
        const status = SESSION_STATUS_MAP[event.type];
        if (status) {
          useSessionStore.getState().setSessionStatus(sessionId, status);
        }
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

    ws.onclose = (e) => {
      // Only reconnect on abnormal close, not normal (1000) or going-away (1001)
      if (e.code !== 1000 && e.code !== 1001 && mountedRef.current) {
        reconnectTimerRef.current = setTimeout(connect, 3000);
      }
    };

    wsRef.current = ws;
  }, [sessionId, handleEvent]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
