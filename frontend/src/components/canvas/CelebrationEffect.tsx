import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { useSessionStore } from '../../stores/sessionStore';

const COLORS = [0x53c28b, 0x7eb8da, 0xf0a500, 0xc89bda, 0xff6b6b, 0x88ccff];
const PARTICLE_COUNT = 40;

export function CelebrationEffect() {
  const prevStatusRef = useRef<string | null>(null);
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

  const status = useSessionStore((s) => s.activeSession?.status ?? null);

  useEffect(() => {
    if (status === 'completed' && prevStatusRef.current !== 'completed') {
      triggerCelebration();
    }
    prevStatusRef.current = status ?? null;
  }, [status]);

  function triggerCelebration() {
    const scene = sceneRef.current;
    if (!scene) return;

    const cx = (scene.scale.width / scene.cameras.main.zoom) / 2;
    const cy = (scene.scale.height / scene.cameras.main.zoom) / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const rect = scene.add.rectangle(
        cx + (Math.random() - 0.5) * 40,
        cy + (Math.random() - 0.5) * 20,
        4 + Math.random() * 4,
        4 + Math.random() * 4,
        COLORS[Math.floor(Math.random() * COLORS.length)],
      );
      rect.setDepth(100);

      scene.tweens.add({
        targets: rect,
        x: rect.x + (Math.random() - 0.5) * 300,
        y: rect.y + Math.random() * 200,
        alpha: 0,
        angle: Math.random() * 360,
        duration: 1200 + Math.random() * 800,
        ease: 'Power2',
        onComplete: () => rect.destroy(),
      });
    }
  }

  return null;
}
