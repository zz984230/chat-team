import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { useAgentStore } from '../../stores/agentStore';
import { AGENT_SEATS, TILE_SIZE } from '../../game/types';

export function FlyingDocument() {
  const prevFilesRef = useRef<Record<string, number>>({});
  const sceneRef = useRef<Phaser.Scene | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const game = (window as any).__phaser_game as Phaser.Game | undefined;
      if (game) {
        sceneRef.current = game.scene.getScene('OfficeScene');
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const agents = useAgentStore((s) => s.agents);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    for (const [agentId, state] of Object.entries(agents)) {
      const prevCount = prevFilesRef.current[agentId] ?? 0;
      const currCount = state.outputFiles.length;
      if (currCount > prevCount) {
        spawnFlyingDoc(scene, agentId);
      }
      prevFilesRef.current[agentId] = currCount;
    }
  }, [agents]);

  function spawnFlyingDoc(scene: Phaser.Scene, agentId: string) {
    const seat = AGENT_SEATS[agentId];
    if (!seat) return;

    const fromX = seat.x * TILE_SIZE + TILE_SIZE / 2;
    const fromY = seat.y * TILE_SIZE + TILE_SIZE / 2;
    const toX = 3 * TILE_SIZE;
    const toY = 10 * TILE_SIZE;

    const doc = scene.add.rectangle(fromX, fromY, 10, 12, 0xfff8dc);
    doc.setStrokeStyle(1, 0x999999);
    doc.setDepth(100);

    scene.tweens.add({
      targets: doc,
      x: toX,
      y: { value: [fromY, fromY - 40, toY], interpolation: 'Bezier' },
      alpha: { from: 1, to: 0.6 },
      duration: 800,
      ease: 'Power1',
      onComplete: () => doc.destroy(),
    });
  }

  return null;
}
