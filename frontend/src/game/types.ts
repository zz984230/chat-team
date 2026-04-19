import type { AgentAnimationState, AgentDirection } from '../types';

export interface GameCallbacks {
  onAgentClick: (agentId: string) => void;
  onRoomClick: (zone: string) => void;
}

export interface AgentVisual {
  agentId: string;
  body: Phaser.GameObjects.Sprite;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleText: Phaser.GameObjects.Text;
  bubbleBg: Phaser.GameObjects.Graphics;
  direction: AgentDirection;
  animState: AgentAnimationState;
}

export interface AgentSeat {
  x: number;
  y: number;
  tint: number;
}

export const AGENT_SEATS: Record<string, AgentSeat> = {
  analyst:   { x: 1, y: 3, tint: 0x53c28b },
  architect: { x: 4, y: 3, tint: 0x7eb8da },
  'dev-lead':   { x: 1, y: 6, tint: 0xf0a500 },
  'test-lead':  { x: 4, y: 6, tint: 0xc89bda },
};

export const TILE_SIZE = 32;
export const MAP_WIDTH = 7;
export const MAP_HEIGHT = 11;

export const ROOM_INFO: Record<string, { name: string; agents: string[] }> = {
  rd: { name: '研发部', agents: ['analyst', 'architect', 'dev-lead', 'test-lead'] },
  meeting: { name: '会议室', agents: [] },
  archive: { name: '档案室', agents: [] },
};

const LIB_COLLISIONS_RAW: boolean[][] = [
  [true,  true,  true,  true,  true,  true,  true ],
  [false, false, false, false, false, false, false],
  [false, false, false, false, false, false, false],
  [false, false, true,  true,  false, false, false],
  [false, false, true,  true,  false, false, false],
  [false, false, true,  true,  false, false, false],
  [false, false, false, false, false, false, true ],
  [false, false, false, false, false, false, true ],
  [false, false, false, false, false, false, true ],
  [true,  false, false, true,  true,  true,  true ],
  [true,  false, false, true,  true,  true,  true ],
];

export function isLibraryWalkable(col: number, row: number): boolean {
  if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) return false;
  for (const seat of Object.values(AGENT_SEATS)) {
    if (seat.x === col && seat.y === row) return true;
  }
  return !LIB_COLLISIONS_RAW[row]![col];
}
