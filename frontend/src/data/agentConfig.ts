export interface AgentVisualConfig {
  agentId: string;
  spriteKey: string;
  spriteUrl: string;
  room: string;
  /** Position in room (tile coordinates) */
  position: { x: number; y: number };
}

export const AGENT_CONFIGS: Record<string, AgentVisualConfig> = {
  analyst: {
    agentId: 'analyst',
    spriteKey: 'f1',
    spriteUrl: '/assets/spritesheets/f1.png',
    room: 'meeting',
    position: { x: 5, y: 5 },
  },
  architect: {
    agentId: 'architect',
    spriteKey: 'f4',
    spriteUrl: '/assets/spritesheets/f4.png',
    room: 'design',
    position: { x: 5, y: 4 },
  },
  researcher: {
    agentId: 'researcher',
    spriteKey: 'f6',
    spriteUrl: '/assets/spritesheets/f6.png',
    room: 'design',
    position: { x: 9, y: 4 },
  },
  writer: {
    agentId: 'writer',
    spriteKey: 'f3',
    spriteUrl: '/assets/spritesheets/f3.png',
    room: 'writing',
    position: { x: 5, y: 12 },
  },
};
