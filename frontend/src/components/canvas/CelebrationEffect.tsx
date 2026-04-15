import { useEffect, useRef } from 'react';
import { Graphics } from 'pixi.js';
import { useViewport } from './PixiCanvas';
import { useSessionStore } from '../../stores/sessionStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = [0x53c28b, 0x7eb8da, 0xf0a500, 0xc89bda, 0xff6b6b, 0x88ccff];
const PARTICLE_COUNT = 40;
const GRAVITY = 0.15;
const LIFETIME = 120;
const FADE_START = 90; // last 30 frames

// ---------------------------------------------------------------------------
// Confetti particle
// ---------------------------------------------------------------------------

interface Particle {
  graphic: Graphics;
  vx: number;
  vy: number;
  age: number;
}

// ---------------------------------------------------------------------------
// CelebrationEffect component
// ---------------------------------------------------------------------------

export function CelebrationEffect() {
  const viewport = useViewport();
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!viewport) return;

    let destroyed = false;

    const spawnConfetti = () => {
      if (destroyed) return;

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const size = 4 + Math.random() * 6; // 4-10px
        const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5; // 3-8

        const graphic = new Graphics();
        graphic.beginFill(color);
        graphic.drawRect(-size / 2, -size / 2, size, size);
        graphic.endFill();
        graphic.rotation = Math.random() * Math.PI * 2;

        graphic.x = centerX;
        graphic.y = centerY;

        viewport.addChild(graphic);

        particlesRef.current.push({
          graphic,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2, // upward bias
          age: 0,
        });
      }

      // Start RAF loop if not already running
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      if (destroyed) return;

      const particles = particlesRef.current;
      let i = particles.length;

      while (i--) {
        const p = particles[i]!;
        p.age++;

        p.vy += GRAVITY;
        p.graphic.x += p.vx;
        p.graphic.y += p.vy;
        p.graphic.rotation += 0.1;

        // Alpha fadeout over last 30 frames
        if (p.age >= FADE_START) {
          p.graphic.alpha = 1 - (p.age - FADE_START) / (LIFETIME - FADE_START);
        }

        // Particle expired
        if (p.age >= LIFETIME) {
          if (p.graphic.parent) {
            p.graphic.parent.removeChild(p.graphic);
          }
          p.graphic.destroy();
          particles.splice(i, 1);
        }
      }

      if (particles.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    // Subscribe to sessionStore for status transitions to 'completed'
    const unsubscribe = useSessionStore.subscribe((state, prevState) => {
      const activeId = state.activeSession?.id;
      if (!activeId) return;
      const prevStatus = prevState.activeSession?.status;
      const currStatus = state.activeSession?.status;
      if (prevStatus !== 'completed' && currStatus === 'completed') {
        spawnConfetti();
      }
    });

    return () => {
      destroyed = true;
      unsubscribe();

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Clean up remaining particles
      for (const p of particlesRef.current) {
        if (p.graphic.parent) {
          p.graphic.parent.removeChild(p.graphic);
        }
        p.graphic.destroy();
      }
      particlesRef.current = [];
    };
  }, [viewport]);

  return null;
}
