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
        useSessionStore.getState().setSessionStatus(sessionId, event.type.split(':')[1]!);
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
