import type { AgentAnimationState, AgentDirection } from '../types';

export interface GameCallbacks {
  onAgentClick: (agentId: string) => void;
  onRoomClick: (zone: string) => void;
}

export interface AgentVisual {
  agentId: string;
  sprite: Phaser.GameObjects.Sprite;
  nameText: Phaser.GameObjects.Text;
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
  analyst: { x: 5, y: 3, tint: 0x53c28b },
  architect: { x: 3, y: 5, tint: 0x7eb8da },
  'dev-lead': { x: 5, y: 7, tint: 0xf0a500 },
  'test-lead': { x: 1, y: 5, tint: 0xc89bda },
};

export const TILE_SIZE = 32;
export const MAP_WIDTH = 7;
export const MAP_HEIGHT = 11;

export const ROOM_INFO: Record<string, { name: string; agents: string[] }> = {
  rd: { name: '研发部', agents: ['analyst', 'architect', 'dev-lead', 'test-lead'] },
  meeting: { name: '会议室', agents: [] },
  archive: { name: '档案室', agents: [] },
};

// Library collision grid (7 cols x 11 rows, from Collisions layer).
// false = walkable, true = blocked.
// Extracted from the_ville.json Collisions layer at (118,19).
const LIB_COLLISIONS_RAW: boolean[][] = [
  [true,  true,  true,  true,  true,  true,  true ],  // row 0 (top wall)
  [false, false, false, false, false, false, false],  // row 1
  [false, false, false, false, false, false, false],  // row 2
  [false, false, true,  true,  false, false, false],  // row 3 (tables)
  [false, false, true,  true,  false, false, false],  // row 4
  [false, false, true,  true,  false, false, false],  // row 5
  [false, false, false, false, false, false, true ],  // row 6
  [false, false, false, false, false, false, true ],  // row 7
  [false, false, false, false, false, false, true ],  // row 8
  [true,  false, false, true,  true,  true,  true ],  // row 9
  [true,  false, false, true,  true,  true,  true ],  // row 10
];

// Seat positions are always valid (agents sit at desks which may be on collision tiles)
export function isLibraryWalkable(col: number, row: number): boolean {
  if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) return false;
  // Check if this is a seat position — seats are always walkable for returning to
  for (const seat of Object.values(AGENT_SEATS)) {
    if (seat.x === col && seat.y === row) return true;
  }
  return !LIB_COLLISIONS_RAW[row][col];
}
