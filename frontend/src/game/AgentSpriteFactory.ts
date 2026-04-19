import type Phaser from 'phaser';
import { TILE_SIZE, AGENT_SEATS, type AgentVisual } from './types';
import type { AgentDirection, AgentAnimationState } from '../types';

const AGENT_ATLAS: Record<string, string> = {
  analyst: 'analyst',
  architect: 'architect',
  'dev-lead': 'dev-lead',
  'test-lead': 'test-lead',
};

const DIR_ANIM: Record<AgentDirection, string> = {
  down: 'misa-front-walk',
  up: 'misa-back-walk',
  left: 'misa-left-walk',
  right: 'misa-right-walk',
};

const DIR_IDLE: Record<AgentDirection, string> = {
  down: 'misa-front',
  up: 'misa-back',
  left: 'misa-left',
  right: 'misa-right',
};

export function defineAnimations(scene: Phaser.Scene) {
  const anims = scene.anims;
  const directions: AgentDirection[] = ['down', 'up', 'left', 'right'];

  for (const agentId of Object.keys(AGENT_ATLAS)) {
    const atlas = AGENT_ATLAS[agentId];
    for (const dir of directions) {
      const framePrefix = DIR_ANIM[dir];
      anims.create({
        key: `${agentId}-${dir}-walk`,
        frames: anims.generateFrameNames(atlas, {
          prefix: `${framePrefix}.`,
          start: 0,
          end: 3,
          zeroPad: 3,
        }),
        frameRate: 4,
        repeat: -1,
      });
    }
  }
}

export function createAgentVisual(
  scene: Phaser.Scene,
  agentId: string,
  onClick: (id: string) => void,
): AgentVisual {
  const seat = AGENT_SEATS[agentId]!;
  const atlas = AGENT_ATLAS[agentId];
  const px = seat.x * TILE_SIZE + TILE_SIZE / 2;
  const py = seat.y * TILE_SIZE + TILE_SIZE / 2;

  const sprite = scene.add.sprite(px, py, atlas, 'misa-front');
  sprite.setScale(0.8);
  sprite.setInteractive({ useHandCursor: true });
  sprite.on('pointerdown', () => onClick(agentId));
  sprite.setDepth(py);

  const nameText = scene.add.text(px, py + 14, agentId, {
    fontSize: '8px',
    color: '#ffffff',
    backgroundColor: '#00000088',
    padding: { x: 2, y: 1 },
  });
  nameText.setOrigin(0.5, 0);
  nameText.setDepth(py);

  const bubbleContainer = scene.add.container(px, py - 28);
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
    sprite,
    nameText,
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
  const id = visual.agentId;

  if (state === 'walking') {
    visual.sprite.play(`${id}-${direction}-walk`, true);
  } else {
    visual.sprite.stop();
    visual.sprite.setFrame(DIR_IDLE[direction]);
  }
}

export function updateBubble(visual: AgentVisual, content: string | null) {
  if (!content) {
    visual.bubbleContainer.setVisible(false);
    return;
  }
  visual.bubbleText.setText(content.length > 30 ? content.slice(0, 30) + '…' : content);
  const tw = visual.bubbleText.width + 8;
  const th = visual.bubbleText.height + 6;
  visual.bubbleBg.clear();
  visual.bubbleBg.fillStyle(0xffffff, 0.9);
  visual.bubbleBg.fillRoundedRect(-tw / 2, -th / 2, tw, th, 4);
  visual.bubbleContainer.setVisible(true);
}

export function moveAgentTo(visual: AgentVisual, targetX: number, targetY: number, scene: Phaser.Scene) {
  // targetX/Y are room-local coords; convert to full map pixel coords
  const LIB_X = 118;
  const LIB_Y = 19;
  const px = (LIB_X + targetX) * TILE_SIZE + TILE_SIZE / 2;
  const py = (LIB_Y + targetY) * TILE_SIZE + TILE_SIZE / 2;

  scene.tweens.add({
    targets: visual.sprite,
    x: px,
    y: py,
    duration: 600,
    ease: 'Power1',
    onUpdate: () => {
      visual.sprite.setDepth(visual.sprite.y);
      visual.nameText.setPosition(visual.sprite.x, visual.sprite.y + 14);
      visual.nameText.setDepth(visual.sprite.y);
      visual.bubbleContainer.setPosition(visual.sprite.x, visual.sprite.y - 28);
    },
  });
}
