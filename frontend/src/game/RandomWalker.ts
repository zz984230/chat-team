import type Phaser from 'phaser';
import { TILE_SIZE, AGENT_SEATS, isLibraryWalkable } from './types';
import type { AgentVisual } from './types';
import type { AgentAnimationState, AgentDirection } from '../types';
import { playAnimation } from './AgentSpriteFactory';

type WalkerState = 'seated' | 'walking' | 'returning';

const LIB_X = 118;
const LIB_Y = 19;
const DIRS: AgentDirection[] = ['up', 'down', 'left', 'right'];
const DIR_DELTA: Record<AgentDirection, { dx: number; dy: number }> = {
  up:    { dx: 0,  dy: -1 },
  down:  { dx: 0,  dy: 1 },
  left:  { dx: -1, dy: 0 },
  right: { dx: 1,  dy: 0 },
};

export class RandomWalker {
  private visual: AgentVisual;
  private scene: Phaser.Scene;
  private state: WalkerState = 'seated';
  private agentState: AgentAnimationState = 'idle';

  private col: number;
  private row: number;
  private readonly seatCol: number;
  private readonly seatRow: number;

  private waitTimer = 0;
  private walkTween: Phaser.Tweens.Tween | null = null;

  constructor(visual: AgentVisual, scene: Phaser.Scene) {
    this.visual = visual;
    this.scene = scene;
    const seat = AGENT_SEATS[visual.agentId]!;
    this.seatCol = seat.x;
    this.seatRow = seat.y;
    this.col = seat.x;
    this.row = seat.y;
  }

  update(delta: number) {
    if (this.agentState !== 'idle') return;
    if (this.state === 'walking' || this.state === 'returning') return;

    this.waitTimer -= delta;
    if (this.waitTimer <= 0) {
      this.startWalk();
    }
  }

  setAgentState(state: AgentAnimationState) {
    const wasActive = this.agentState !== 'idle';
    this.agentState = state;

    if (state !== 'idle' && this.state !== 'seated') {
      this.returnToSeat();
    } else if (state === 'idle' && !wasActive) {
      this.scheduleNextWalk();
    }
  }

  private scheduleNextWalk() {
    this.waitTimer = 2000 + Math.random() * 3000;
  }

  private startWalk() {
    const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
    let chosen: AgentDirection | null = null;

    for (const dir of shuffled) {
      const { dx, dy } = DIR_DELTA[dir];
      const nc = this.col + dx;
      const nr = this.row + dy;
      if (isLibraryWalkable(nc, nr)) {
        chosen = dir;
        this.col = nc;
        this.row = nr;
        break;
      }
    }

    if (!chosen) {
      this.scheduleNextWalk();
      return;
    }

    this.state = 'walking';
    playAnimation(this.visual, 'walking', chosen);

    const px = (LIB_X + this.col) * TILE_SIZE + TILE_SIZE / 2;
    const py = (LIB_Y + this.row) * TILE_SIZE + TILE_SIZE / 2;

    this.walkTween = this.scene.tweens.add({
      targets: this.visual.sprite,
      x: px,
      y: py,
      duration: 300,
      ease: 'Linear',
      onUpdate: () => {
        this.visual.sprite.setDepth(this.visual.sprite.y);
        this.visual.nameText.setPosition(this.visual.sprite.x, this.visual.sprite.y + 14);
        this.visual.nameText.setDepth(this.visual.sprite.y);
        this.visual.bubbleContainer.setPosition(this.visual.sprite.x, this.visual.sprite.y - 28);
      },
      onComplete: () => {
        this.walkTween = null;
        playAnimation(this.visual, 'idle', chosen!);
        this.state = 'seated';
        if (Math.random() < 0.7) {
          this.scheduleNextWalk();
        } else {
          this.waitTimer = 3000 + Math.random() * 4000;
        }
      },
    });
  }

  private returnToSeat() {
    if (this.walkTween) {
      this.walkTween.stop();
      this.walkTween = null;
    }

    this.col = this.seatCol;
    this.row = this.seatRow;
    this.state = 'returning';

    const px = (LIB_X + this.seatCol) * TILE_SIZE + TILE_SIZE / 2;
    const py = (LIB_Y + this.seatRow) * TILE_SIZE + TILE_SIZE / 2;

    playAnimation(this.visual, 'walking', this.visual.direction);

    this.scene.tweens.add({
      targets: this.visual.sprite,
      x: px,
      y: py,
      duration: 600,
      ease: 'Power1',
      onUpdate: () => {
        this.visual.sprite.setDepth(this.visual.sprite.y);
        this.visual.nameText.setPosition(this.visual.sprite.x, this.visual.sprite.y + 14);
        this.visual.nameText.setDepth(this.visual.sprite.y);
        this.visual.bubbleContainer.setPosition(this.visual.sprite.x, this.visual.sprite.y - 28);
      },
      onComplete: () => {
        playAnimation(this.visual, 'idle', 'down');
        this.state = 'seated';
        this.scheduleNextWalk();
      },
    });
  }

  destroy() {
    if (this.walkTween) {
      this.walkTween.stop();
      this.walkTween = null;
    }
  }
}
