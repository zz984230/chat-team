import { Container, Graphics } from '@pixi/react';
import { useCallback } from 'react';
import { Text } from '@pixi/text';
import { Circle } from '@pixi/math';
import type { Graphics as PixiGraphics } from '@pixi/graphics';
import { AGENT_CONFIGS } from '../../data/agentConfig';
import { MAP_CONFIG, ROOMS } from '../../data/mapConfig';
import { useAgentStore } from '../../stores/agentStore';
import { useUiStore } from '../../stores/uiStore';
import type { AgentAnimationState } from '../../types';

const AGENT_COLORS: Record<string, number> = {
  analyst: 0x53c28b,
  architect: 0x7eb8da,
  researcher: 0xf0a500,
  writer: 0xc89bda,
};

const AGENT_NAMES: Record<string, string> = {
  analyst: '需求分析师',
  architect: '方案架构师',
  researcher: '资料研究员',
  writer: '方案撰写员',
};

function PlaceholderSprite({
  color,
  x,
  y,
  onClick,
}: {
  color: number;
  x: number;
  y: number;
  onClick: () => void;
}) {
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(color);
      g.drawCircle(0, 0, 12);
      g.endFill();
      g.beginFill(0xffffff);
      g.drawCircle(0, -4, 4);
      g.endFill();
      g.hitArea = new Circle(0, 0, 16);
    },
    [color],
  );
  return <Graphics draw={draw} x={x} y={y} interactive pointerdown={onClick} />;
}

function AgentLabel({ name, x, y }: { name: string; x: number; y: number }) {
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      const label = new Text(name, {
        fontFamily: 'sans-serif',
        fontSize: 10,
        fill: 0xcccccc,
        align: 'center',
      });
      label.anchor.set(0.5);
      label.x = 0;
      label.y = 20;
      g.addChild(label);
    },
    [name],
  );
  return <Graphics draw={draw} x={x} y={y} />;
}

function ThinkingIndicator({
  x,
  y,
  content,
}: {
  x: number;
  y: number;
  content: string;
}) {
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0x16213e, 0.9);
      g.drawRoundedRect(-40, -20, 80, 24, 6);
      g.endFill();
      g.beginFill(0x16213e, 0.9);
      g.drawPolygon([0, 4, -5, -2, 5, -2]);
      g.endFill();
      const displayText =
        content.length > 12 ? content.slice(0, 12) + '...' : content;
      const text = new Text(displayText, {
        fontFamily: 'sans-serif',
        fontSize: 9,
        fill: 0x7eb8da,
      });
      text.anchor.set(0.5);
      text.x = 0;
      text.y = -8;
      g.addChild(text);
    },
    [content],
  );
  return <Graphics draw={draw} x={x} y={y} />;
}

function WorkingIndicator({
  x,
  y,
  tool,
}: {
  x: number;
  y: number;
  tool: string;
}) {
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0x0f3460, 0.9);
      g.drawRoundedRect(-30, -16, 60, 18, 4);
      g.endFill();
      const text = new Text('\u26A1 ' + tool, {
        fontFamily: 'sans-serif',
        fontSize: 9,
        fill: 0xf0a500,
      });
      text.anchor.set(0.5);
      text.x = 0;
      text.y = -7;
      g.addChild(text);
    },
    [tool],
  );
  return <Graphics draw={draw} x={x} y={y} />;
}

export function AgentSprite({ agentId }: { agentId: string }) {
  const agentState = useAgentStore((s) => s.agents[agentId]);
  const openAgentDetail = useUiStore((s) => s.openAgentDetail);
  const animationState: AgentAnimationState =
    agentState?.animationState ?? 'idle';

  const room = ROOMS.find((r) => r.agents.includes(agentId));
  const seat = room?.seats[agentId] ?? { x: 0, y: 0 };
  const pixelX = seat.x * MAP_CONFIG.tileWidth;
  const pixelY = seat.y * MAP_CONFIG.tileHeight;

  const handleClick = () => {
    openAgentDetail(agentId);
  };

  return (
    <Container>
      <PlaceholderSprite
        color={AGENT_COLORS[agentId] ?? 0xffffff}
        x={pixelX}
        y={pixelY}
        onClick={handleClick}
      />
      <AgentLabel
        name={AGENT_NAMES[agentId] ?? agentId}
        x={pixelX}
        y={pixelY}
      />
      {animationState === 'thinking' && (
        <ThinkingIndicator
          x={pixelX}
          y={pixelY - 20}
          content={agentState?.thinkingContent ?? ''}
        />
      )}
      {animationState === 'working' && (
        <WorkingIndicator
          x={pixelX}
          y={pixelY - 20}
          tool={agentState?.currentTool ?? ''}
        />
      )}
    </Container>
  );
}

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
