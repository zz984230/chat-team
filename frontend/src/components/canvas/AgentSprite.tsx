import { useEffect, useRef } from 'react';
import { BaseTexture, Spritesheet, AnimatedSprite, Container, Text, Graphics } from 'pixi.js';
import { useViewport } from './PixiCanvas';
import { AGENT_CONFIGS } from '../../data/agentConfig';
import { MAP_CONFIG, AGENT_SEATS } from '../../data/mapConfig';
import { useAgentStore } from '../../stores/agentStore';
import { useUiStore } from '../../stores/uiStore';
import type { AgentAnimationState, AgentDirection } from '../../types';

import { spritesheetData as f1Data } from '../../data/spritesheets/f1';
import { spritesheetData as f3Data } from '../../data/spritesheets/f3';
import { spritesheetData as f4Data } from '../../data/spritesheets/f4';
import { spritesheetData as f6Data } from '../../data/spritesheets/f6';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_NAMES: Record<string, string> = {
  analyst: '需求分析师',
  architect: '方案架构师',
  'dev-lead': '开发负责人',
  'test-lead': '测试负责人',
};

const SPRITESHEET_DATA_MAP: Record<string, typeof f1Data> = {
  f1: f1Data,
  f3: f3Data,
  f4: f4Data,
  f6: f6Data,
};

/** Module-level spritesheet cache – shared across all agent instances. */
const spritesheetCache = new Map<string, Spritesheet>();

const LERP_SPEED = 0.03;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function directionFromDelta(dx: number, dy: number): AgentDirection {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

async function loadSpritesheet(
  spriteKey: string,
  spriteUrl: string,
): Promise<Spritesheet> {
  const cached = spritesheetCache.get(spriteKey);
  if (cached) return cached;

  const data = SPRITESHEET_DATA_MAP[spriteKey];
  if (!data) throw new Error(`No spritesheet data for key "${spriteKey}"`);

  const baseTexture = BaseTexture.from(spriteUrl);
  const sheet = new Spritesheet(baseTexture, data);
  await sheet.parse();

  spritesheetCache.set(spriteKey, sheet);
  return sheet;
}

function createThinkingBubble(content: string): Container {
  const container = new Container();

  const displayText = content.length > 50 ? content.slice(0, 50) + '...' : content;

  const text = new Text(displayText, {
    fontFamily: 'sans-serif',
    fontSize: 9,
    fill: 0x7eb8da,
    wordWrap: true,
    wordWrapWidth: 76,
  });

  const textWidth = text.width;
  const textHeight = text.height;
  const padding = 6;
  const bgWidth = textWidth + padding * 2;
  const bgHeight = textHeight + padding * 2;

  const bg = new Graphics();
  bg.beginFill(0x16213e, 0.9);
  bg.drawRoundedRect(-bgWidth / 2, -bgHeight, bgWidth, bgHeight, 6);
  bg.endFill();

  // Triangle tail pointing down
  bg.beginFill(0x16213e, 0.9);
  bg.drawPolygon([0, 4, -5, -2, 5, -2]);
  bg.endFill();

  text.anchor.set(0.5);
  text.x = 0;
  text.y = -bgHeight / 2;

  container.addChild(bg);
  container.addChild(text);

  return container;
}

// ---------------------------------------------------------------------------
// AgentSprite (imperative)
// ---------------------------------------------------------------------------

export function AgentSprite({ agentId }: { agentId: string }) {
  const viewport = useViewport();

  // Mutable refs to hold PixiJS objects & animation state
  const containerRef = useRef<Container | null>(null);
  const spriteRef = useRef<AnimatedSprite | null>(null);
  const labelRef = useRef<Text | null>(null);
  const bubbleRef = useRef<Container | null>(null);
  const sheetRef = useRef<Spritesheet | null>(null);
  const rafRef = useRef<number | null>(null);
  const lerpRef = useRef<{ from: { x: number; y: number }; to: { x: number; y: number }; progress: number } | null>(null);

  // Load config
  const config = AGENT_CONFIGS[agentId];
  if (!config) return null;

  // Calculate initial position (in pixels)
  const seat = AGENT_SEATS[agentId] ?? { x: config.position.x, y: config.position.y };
  const initialPixelX = seat.x * MAP_CONFIG.tileWidth;
  const initialPixelY = seat.y * MAP_CONFIG.tileHeight;

  // -----------------------------------------------------------------------
  // Effect 1: Create PixiJS objects, load spritesheet, start RAF loop
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!viewport) return;

    let destroyed = false;

    const container = new Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', () => {
      useUiStore.getState().openAgentDetail(agentId);
    });
    containerRef.current = container;

    // Name label
    const label = new Text(AGENT_NAMES[agentId] ?? agentId, {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fill: 0xcccccc,
      align: 'center',
    });
    label.anchor.set(0.5);
    label.x = 0;
    label.y = 22;
    labelRef.current = label;
    container.addChild(label);

    viewport.addChild(container);

    // Load spritesheet and create AnimatedSprite
    loadSpritesheet(config.spriteKey, config.spriteUrl)
      .then((sheet) => {
        if (destroyed) return;
        sheetRef.current = sheet;

        const textures = sheet.animations['down'];
        if (!textures || textures.length === 0) return;

        const sprite = new AnimatedSprite(textures);
        sprite.anchor.set(0.5, 0.7);
        sprite.animationSpeed = config.animationSpeed.idle;
        sprite.play();
        spriteRef.current = sprite;

        // Insert sprite before label so label renders on top
        container.addChildAt(sprite, 0);

        // Set initial position
        container.x = initialPixelX;
        container.y = initialPixelY;
      })
      .catch((err) => {
        console.error(`Failed to load spritesheet for ${agentId}:`, err);
        // Fallback: still set position even without sprite
        container.x = initialPixelX;
        container.y = initialPixelY;
      });

    // Set initial position immediately (sprite may load async)
    container.x = initialPixelX;
    container.y = initialPixelY;

    // RAF loop for lerp movement
    const tick = () => {
      const lerp = lerpRef.current;
      if (lerp) {
        lerp.progress += LERP_SPEED;
        if (lerp.progress >= 1) {
          lerp.progress = 1;
        }
        // Ease-out interpolation
        const t = lerp.progress;
        const eased = t < 1 ? 1 - Math.pow(1 - t, 2) : 1;
        container.x = lerp.from.x + (lerp.to.x - lerp.from.x) * eased;
        container.y = lerp.from.y + (lerp.to.y - lerp.from.y) * eased;

        if (lerp.progress >= 1) {
          lerpRef.current = null;
          // Clear targetPosition in store
          const state = useAgentStore.getState();
          if (state.agents[agentId]?.targetPosition) {
            useAgentStore.setState((s) => ({
              agents: {
                ...s.agents,
                [agentId]: {
                  ...(s.agents[agentId] ?? {}),
                  targetPosition: null,
                  animationState: s.agents[agentId]?.animationState === 'walking' ? 'idle' : s.agents[agentId]?.animationState,
                } as any,
              },
            }));
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      destroyed = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (container.parent) {
        container.parent.removeChild(container);
      }
      container.destroy({ children: true });
      containerRef.current = null;
      spriteRef.current = null;
      labelRef.current = null;
      bubbleRef.current = null;
      sheetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport]);

  // -----------------------------------------------------------------------
  // Effect 2: Subscribe to agentStore, react to animation/movement/bubble
  // -----------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = useAgentStore.subscribe((state) => {
      const agent = state.agents[agentId];
      const container = containerRef.current;
      const sprite = spriteRef.current;
      const sheet = sheetRef.current;
      if (!container || !sprite || !sheet) return;

      // --- Animation state & direction ---
      const animState: AgentAnimationState = agent?.animationState ?? 'idle';
      const direction: AgentDirection = agent?.direction ?? 'down';
      const speed = config.animationSpeed;

      let targetDirection: AgentDirection = direction;
      let targetSpeed: number;

      switch (animState) {
        case 'walking':
          targetSpeed = speed.walking;
          break;
        case 'working':
          targetDirection = 'down';
          targetSpeed = speed.working;
          break;
        case 'thinking':
          targetDirection = 'down';
          targetSpeed = speed.thinking;
          break;
        default: // idle
          targetDirection = 'down';
          targetSpeed = speed.idle;
          break;
      }

      // Update textures if direction changed
      const currentTextures = sprite.textures;
      const newTextures = sheet.animations[targetDirection];
      if (newTextures && newTextures !== currentTextures) {
        sprite.textures = newTextures;
        sprite.play();
      }

      sprite.animationSpeed = targetSpeed;

      // --- Lerp movement ---
      const targetPos = agent?.targetPosition;
      if (targetPos && !lerpRef.current) {
        const toPixel = {
          x: targetPos.x * MAP_CONFIG.tileWidth,
          y: targetPos.y * MAP_CONFIG.tileHeight,
        };
        lerpRef.current = {
          from: { x: container.x, y: container.y },
          to: toPixel,
          progress: 0,
        };

        // Set walking direction based on delta
        const dx = toPixel.x - container.x;
        const dy = toPixel.y - container.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          const moveDir = directionFromDelta(dx, dy);
          const walkTextures = sheet.animations[moveDir];
          if (walkTextures) {
            sprite.textures = walkTextures;
            sprite.play();
          }
        }
      }

      // --- Thinking bubble ---
      const existingBubble = bubbleRef.current;
      const shouldShowBubble = animState === 'thinking' && agent?.thinkingContent;

      if (shouldShowBubble && agent?.thinkingContent) {
        // Check if content changed – rebuild bubble
        const currentContent = (existingBubble as any)?._bubbleContent as string | undefined;
        if (currentContent !== agent.thinkingContent) {
          // Remove old bubble
          if (existingBubble) {
            container.removeChild(existingBubble);
            existingBubble.destroy({ children: true });
          }
          // Create new bubble
          const bubble = createThinkingBubble(agent.thinkingContent);
          (bubble as any)._bubbleContent = agent.thinkingContent;
          bubble.x = 0;
          bubble.y = -28;
          container.addChild(bubble);
          bubbleRef.current = bubble;
        }
      } else {
        // Remove bubble
        if (existingBubble) {
          container.removeChild(existingBubble);
          existingBubble.destroy({ children: true });
          bubbleRef.current = null;
        }
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Imperative component – no JSX output
  return null;
}

// ---------------------------------------------------------------------------
// AllAgentSprites – renders all 4 agents
// ---------------------------------------------------------------------------

export function AllAgentSprites() {
  const agentIds = Object.keys(AGENT_CONFIGS);
  return (
    <>
      {agentIds.map((id) => (
        <AgentSprite key={id} agentId={id} />
      ))}
    </>
  );
}
