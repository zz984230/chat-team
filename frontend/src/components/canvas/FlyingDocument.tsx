import { useEffect, useRef } from 'react';
import { Graphics } from 'pixi.js';
import { useViewport } from './PixiCanvas';
import { useAgentStore } from '../../stores/agentStore';
import { AGENT_CONFIGS } from '../../data/agentConfig';
import { MAP_CONFIG, AGENT_SEATS } from '../../data/mapConfig';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLIGHT_DURATION = 800;

const ARCHIVE_CENTER = {
  x: (MAP_CONFIG.mapWidth / 2) * MAP_CONFIG.tileWidth,
  y: (MAP_CONFIG.mapHeight - 2) * MAP_CONFIG.tileHeight,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAgentPosition(agentId: string): { x: number; y: number } {
  const config = AGENT_CONFIGS[agentId]!;
  const seat = AGENT_SEATS[agentId];
  const pos = seat ?? config.position;
  return { x: pos.x * MAP_CONFIG.tileWidth, y: pos.y * MAP_CONFIG.tileHeight };
}

function createDocumentGraphic(): Graphics {
  const g = new Graphics();

  // White rectangle body
  g.beginFill(0xffeedd);
  g.drawRect(-8, -10, 16, 20);
  g.endFill();

  // Folded corner - darker triangle (right half top)
  g.beginFill(0xddccbb);
  g.drawPolygon([0, -10, 8, -10, 8, -2]);
  g.endFill();

  // Fold triangle
  g.beginFill(0xccbbaa);
  g.drawPolygon([0, -10, 8, -2, 0, -2]);
  g.endFill();

  // Text lines
  g.lineStyle(1, 0x999999);
  g.moveTo(-5, -4);
  g.lineTo(5, -4);
  g.moveTo(-5, 0);
  g.lineTo(5, 0);
  g.moveTo(-5, 4);
  g.lineTo(2, 4);
  g.lineStyle(0);

  return g;
}

interface FlightState {
  graphic: Graphics;
  from: { x: number; y: number };
  to: { x: number; y: number };
  peakY: number;
  startTime: number;
}

// ---------------------------------------------------------------------------
// FlyingDocument component
// ---------------------------------------------------------------------------

export function FlyingDocument() {
  const viewport = useViewport();
  const flightsRef = useRef<FlightState[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!viewport) return;

    let destroyed = false;

    // RAF animation loop
    const tick = (now: number) => {
      if (destroyed) return;

      const flights = flightsRef.current;
      let i = flights.length;
      while (i--) {
        const flight = flights[i]!;
        const elapsed = now - flight.startTime;
        const t = Math.min(elapsed / FLIGHT_DURATION, 1);

        // Linear x interpolation
        const x = flight.from.x + (flight.to.x - flight.from.x) * t;

        // Quadratic bezier y interpolation
        const y =
          (1 - t) * (1 - t) * flight.from.y +
          2 * (1 - t) * t * flight.peakY +
          t * t * flight.to.y;

        flight.graphic.x = x;
        flight.graphic.y = y;

        // Alpha fadeout over last 20%
        if (t > 0.8) {
          flight.graphic.alpha = 1 - (t - 0.8) / 0.2;
        }

        // Flight complete
        if (t >= 1) {
          if (flight.graphic.parent) {
            flight.graphic.parent.removeChild(flight.graphic);
          }
          flight.graphic.destroy();
          flights.splice(i, 1);
        }
      }

      // Continue loop only if there are active flights
      if (flights.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    // Subscribe to agentStore for output file changes
    const unsubscribe = useAgentStore.subscribe((state, prevState) => {
      if (destroyed) return;

      for (const agentId of Object.keys(state.agents)) {
        const prev = prevState.agents[agentId];
        const curr = state.agents[agentId];
        if (!curr || !prev) continue;

        if (curr.outputFiles.length > prev.outputFiles.length) {
          // New output file detected — spawn flight
          const from = getAgentPosition(agentId);
          const randomOffsetX = (Math.random() - 0.5) * 40; // +-20px
          const randomOffsetY = (Math.random() - 0.5) * 40;
          const to = {
            x: ARCHIVE_CENTER.x + randomOffsetX,
            y: ARCHIVE_CENTER.y + randomOffsetY,
          };
          const peakY = Math.min(from.y, to.y) - 80;

          const graphic = createDocumentGraphic();
          graphic.x = from.x;
          graphic.y = from.y;
          viewport.addChild(graphic);

          const flight: FlightState = {
            graphic,
            from,
            to,
            peakY,
            startTime: performance.now(),
          };

          flightsRef.current.push(flight);

          // Start RAF loop if not already running
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(tick);
          }
        }
      }
    });

    return () => {
      destroyed = true;
      unsubscribe();

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Clean up any remaining flights
      for (const flight of flightsRef.current) {
        if (flight.graphic.parent) {
          flight.graphic.parent.removeChild(flight.graphic);
        }
        flight.graphic.destroy();
      }
      flightsRef.current = [];
    };
  }, [viewport]);

  return null;
}
