import { TILE_SIZE, AGENT_SEATS, type AgentVisual } from './types';
import type { AgentDirection, AgentAnimationState } from '../types';

const BUBBLE_OFFSET_Y = -48;

const ANIM_PREFIX: Record<AgentAnimationState, string> = {
  idle: 'idle',
  walking: 'walk',
  working: 'idle',
  thinking: 'idle',
};

const DIR_KEY: Record<AgentDirection, string> = {
  down: 'front',
  up: 'back',
  left: 'left',
  right: 'right',
};

export function defineAnimations(scene: Phaser.Scene) {
  if (scene.anims.exists('idle-front')) return;

  const dirs = ['front', 'back', 'left', 'right'] as const;

  for (const dir of dirs) {
    scene.anims.create({
      key: `idle-${dir}`,
      frames: [{ key: 'agents', frame: `misa-${dir}` }],
      frameRate: 8,
      repeat: -1,
    });

    scene.anims.create({
      key: `walk-${dir}`,
      frames: scene.anims.generateFrameNames('agents', {
        prefix: `misa-${dir}-walk.`,
        start: 0,
        end: 3,
        zeroPad: 3,
      }),
      frameRate: 8,
      repeat: -1,
    });
  }
}

export function createAgentVisual(
  scene: Phaser.Scene,
  agentId: string,
  onClick: (id: string) => void,
): AgentVisual {
  const seat = AGENT_SEATS[agentId]!;
  const px = seat.x * TILE_SIZE + TILE_SIZE / 2;
  const py = seat.y * TILE_SIZE + TILE_SIZE / 2;

  const body = scene.add.sprite(px, py, 'agents', 'misa-front');
  body.setOrigin(0.5, 1);
  body.setTint(seat.tint);
  body.setDepth(py);
  body.setInteractive({ useHandCursor: true });
  body.on('pointerdown', () => onClick(agentId));

  const bubbleContainer = scene.add.container(px, py + BUBBLE_OFFSET_Y);
  bubbleContainer.setDepth(py + 1);
  bubbleContainer.setVisible(false);

  const bubbleBg = scene.add.graphics();
  const bubbleText = scene.add.text(0, 0, '', {
    fontSize: '9px',
    color: '#333333',
    wordWrap: { width: 80 },
    align: 'center',
  });
  bubbleText.setOrigin(0.5, 0.5);
  bubbleContainer.add([bubbleBg, bubbleText]);

  return {
    agentId,
    body,
    bubbleContainer,
    bubbleText,
    bubbleBg,
    direction: 'down',
    animState: 'idle',
  };
}

export function playAnimation(visual: AgentVisual, state: AgentAnimationState, direction: AgentDirection) {
  visual.animState = state;
  visual.direction = direction;
  const animKey = `${ANIM_PREFIX[state]}-${DIR_KEY[direction]}`;
  if (visual.body.anims?.currentAnim?.key !== animKey) {
    visual.body.play(animKey);
  }
}

export function updateBubble(visual: AgentVisual, content: string | null) {
  if (!content) {
    visual.bubbleContainer.setVisible(false);
    return;
  }
  visual.bubbleText.setText(content.length > 30 ? content.slice(0, 30) + '\u2026' : content);
  const tw = visual.bubbleText.width + 8;
  const th = visual.bubbleText.height + 6;
  visual.bubbleBg.clear();
  visual.bubbleBg.fillStyle(0xffffff, 0.9);
  visual.bubbleBg.fillRoundedRect(-tw / 2, -th / 2, tw, th, 4);
  visual.bubbleContainer.setVisible(true);
}

export function moveAgentTo(visual: AgentVisual, targetX: number, targetY: number, scene: Phaser.Scene) {
  const LIB_X = 118;
  const LIB_Y = 19;
  const px = (LIB_X + targetX) * TILE_SIZE + TILE_SIZE / 2;
  const py = (LIB_Y + targetY) * TILE_SIZE + TILE_SIZE / 2;

  scene.tweens.add({
    targets: visual.body,
    x: px,
    y: py,
    duration: 600,
    ease: 'Power1',
    onUpdate: () => {
      syncPosition(visual);
    },
  });
}

export function syncPosition(visual: AgentVisual) {
  const x = visual.body.x;
  const y = visual.body.y;
  visual.body.setDepth(y);
  visual.bubbleContainer.setPosition(x, y + BUBBLE_OFFSET_Y);
}
