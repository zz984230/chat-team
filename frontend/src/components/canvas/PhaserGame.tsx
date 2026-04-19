import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { OfficeScene } from '../../game/OfficeScene';
import { useAgentStore } from '../../stores/agentStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useUiStore } from '../../stores/uiStore';
import type { AgentAnimationState, AgentDirection } from '../../types';

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const scene = new OfficeScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      parent: containerRef.current,
      pixelArt: true,
      backgroundColor: '#1a1a2e',
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 } },
      },
      scene: scene,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    scene.setCallbacks({
      onAgentClick: (agentId: string) => {
        useUiStore.getState().openAgentDetail(agentId);
      },
      onRoomClick: (zone: string) => {
        if (zone === 'archive') {
          useUiStore.getState().openRoomArchive('rd');
        } else if (zone === 'task') {
          useUiStore.getState().openNewTaskModal('rd');
        }
      },
    });

    gameRef.current = game;
    (window as any).__phaser_game = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
      (window as any).__phaser_game = null;
    };
  }, []);

  const agents = useAgentStore((s) => s.agents);
  const activeSession = useSessionStore((s) => s.activeSession);
  const prevAgentsRef = useRef<Record<string, string>>({});
  const prevSessionIdRef = useRef<string | null>(null);

  // Reset agents BEFORE applying state changes — hook order matters
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !scene.scene?.isActive) return;

    if (activeSession && activeSession.id !== prevSessionIdRef.current) {
      prevSessionIdRef.current = activeSession.id;
      scene.resetAllAgents();
      prevAgentsRef.current = {}; // clear cached state so thinking events re-apply
    } else if (!activeSession) {
      prevSessionIdRef.current = null;
    }
  }, [activeSession]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !scene.scene?.isActive) return;

    for (const [agentId, state] of Object.entries(agents)) {
      const key = `${state.animationState}|${state.direction}|${state.thinkingContent}|${state.targetPosition?.x},${state.targetPosition?.y}`;
      if (prevAgentsRef.current[agentId] === key) continue;
      prevAgentsRef.current[agentId] = key;

      if (state.animationState) {
        scene.setAgentState(agentId, state.animationState as AgentAnimationState);
      }
      if (state.direction) {
        scene.setAgentDirection(agentId, state.direction as AgentDirection);
      }
      scene.setAgentThinking(agentId, state.thinkingContent);
      if (state.targetPosition) {
        scene.setAgentPosition(agentId, state.targetPosition.x, state.targetPosition.y);
      }
    }
  }, [agents]);

  return <div ref={containerRef} className="w-full h-full" />;
}
