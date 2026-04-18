export interface AgentVisualConfig {
  agentId: string;
  spriteKey: string;
  spriteUrl: string;
  room: string;
  position: { x: number; y: number };
  homePosition: { x: number; y: number };
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
    room: 'rd',
    position: { x: 11, y: 3 },
    homePosition: { x: 11, y: 3 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
  architect: {
    agentId: 'architect',
    spriteKey: 'f4',
    spriteUrl: '/assets/32x32folk.png',
    room: 'rd',
    position: { x: 14, y: 5 },
    homePosition: { x: 14, y: 5 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
  'dev-lead': {
    agentId: 'dev-lead',
    spriteKey: 'f6',
    spriteUrl: '/assets/32x32folk.png',
    room: 'rd',
    position: { x: 11, y: 7 },
    homePosition: { x: 11, y: 7 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
  'test-lead': {
    agentId: 'test-lead',
    spriteKey: 'f3',
    spriteUrl: '/assets/32x32folk.png',
    room: 'rd',
    position: { x: 8, y: 5 },
    homePosition: { x: 8, y: 5 },
    animationSpeed: { idle: 0.08, walking: 0.15, working: 0.08, thinking: 0.08 },
  },
};
