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
