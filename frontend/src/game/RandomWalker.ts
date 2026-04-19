import { TILE_SIZE, AGENT_SEATS, isLibraryWalkable } from './types';
import type { AgentVisual } from './types';
import type { AgentAnimationState, AgentDirection } from '../types';
import { playAnimation, syncPosition } from './AgentSpriteFactory';

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
  private state: WalkerState = 'seated';
  private agentState: AgentAnimationState = 'idle';

  private col: number;
  private row: number;
  private readonly seatCol: number;
  private readonly seatRow: number;

  private waitTimer = 0;

  // Manual movement interpolation
  private moveStartX = 0;
  private moveStartY = 0;
  private moveTargetX = 0;
  private moveTargetY = 0;
  private moveDuration = 0;
  private moveElapsed = 0;
  private walkDirection: AgentDirection = 'down';

  constructor(visual: AgentVisual) {
    this.visual = visual;
    const seat = AGENT_SEATS[visual.agentId]!;
    this.seatCol = seat.x;
    this.seatRow = seat.y;
    this.col = seat.x;
    this.row = seat.y;
  }

  update(delta: number) {
    if (this.state === 'walking' || this.state === 'returning') {
      this.advanceMove(delta);
    }

    if (this.agentState !== 'idle') return;
    if (this.state !== 'seated') return;

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

  private pixelX(c: number) { return (LIB_X + c) * TILE_SIZE + TILE_SIZE / 2; }
  private pixelY(r: number) { return (LIB_Y + r) * TILE_SIZE + TILE_SIZE / 2; }

  private beginMove(targetCol: number, targetRow: number, duration: number, state: WalkerState, dir: AgentDirection) {
    this.moveStartX = this.visual.body.x;
    this.moveStartY = this.visual.body.y;
    this.moveTargetX = this.pixelX(targetCol);
    this.moveTargetY = this.pixelY(targetRow);
    this.moveDuration = duration;
    this.moveElapsed = 0;
    this.state = state;
    this.walkDirection = dir;
    playAnimation(this.visual, 'walking', dir);
  }

  private advanceMove(delta: number) {
    this.moveElapsed += delta;
    const t = Math.min(this.moveElapsed / this.moveDuration, 1);
    const x = this.moveStartX + (this.moveTargetX - this.moveStartX) * t;
    const y = this.moveStartY + (this.moveTargetY - this.moveStartY) * t;

    this.visual.body.setPosition(x, y);
    syncPosition(this.visual);

    if (t >= 1) {
      this.onMoveComplete();
    }
  }

  private onMoveComplete() {
    playAnimation(this.visual, 'idle', this.walkDirection);

    if (this.state === 'walking') {
      this.state = 'seated';
      if (Math.random() < 0.7) {
        this.scheduleNextWalk();
      } else {
        this.waitTimer = 3000 + Math.random() * 4000;
      }
    } else {
      this.state = 'seated';
      this.scheduleNextWalk();
    }
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

    this.beginMove(this.col, this.row, 300, 'walking', chosen);
  }

  private returnToSeat() {
    this.col = this.seatCol;
    this.row = this.seatRow;
    this.beginMove(this.seatCol, this.seatRow, 600, 'returning', this.visual.direction);
  }

  destroy() {}
}
