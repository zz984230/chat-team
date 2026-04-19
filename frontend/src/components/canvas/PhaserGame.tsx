import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { OfficeScene } from '../../game/OfficeScene';
import { useAgentStore } from '../../stores/agentStore';
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
      onRoomClick: (_zone: string) => {},
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
  const prevAgentsRef = useRef<Record<string, string>>({});

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
