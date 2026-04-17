export interface AgentVisualConfig {
  agentId: string;
  spriteKey: string;
  spriteUrl: string;
  room: string;
  /** Position in room (tile coordinates) */
  position: { x: number; y: number };
  /** Home position (same as position, used for returning after tasks) */
  homePosition: { x: number; y: number };
  /** Animation speed for different states (frames per second) */
  animationSpeed: {
    idle: number;
    walking: number;
    working: number;
    thinking: number;
  };
}

export const AGENT_CONFIGS: Record<string, AgentVisualConfig> = {
  analyst: {
    agentId: 'analyst',
    spriteKey: 'f1',
    spriteUrl: '/assets/32x32folk.png',
    room: 'meeting',
    position: { x: 5, y: 5 },
    homePosition: { x: 5, y: 5 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
  architect: {
    agentId: 'architect',
    spriteKey: 'f4',
    spriteUrl: '/assets/32x32folk.png',
    room: 'design',
    position: { x: 5, y: 4 },
    homePosition: { x: 5, y: 4 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
  writer: {
    agentId: 'writer',
    spriteKey: 'f3',
    spriteUrl: '/assets/32x32folk.png',
    room: 'writing',
    position: { x: 5, y: 12 },
    homePosition: { x: 5, y: 12 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
};
