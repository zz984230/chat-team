export const MAP_CONFIG = {
  tileWidth: 32,
  tileHeight: 32,
  mapWidth: 24,
  mapHeight: 18,
  companyName: 'Virtual Office',
  corridorColor: 0x222233,
  wallColor: 0x1a1a2a,
  wallThickness: 3,
};

// Agent seats — used by AgentSprite and FlyingDocument for positioning
export const AGENT_SEATS: Record<string, { x: number; y: number; roomId: string }> = {
  analyst: { x: 11, y: 3, roomId: 'rd' },
  architect: { x: 14, y: 5, roomId: 'rd' },
  'dev-lead': { x: 11, y: 7, roomId: 'rd' },
  'test-lead': { x: 8, y: 5, roomId: 'rd' },
};

// Room metadata — used by NewTaskModal and ArchiveDrawer for room name/agent lookups
export const ROOM_INFO: Record<string, { name: string; agents: string[] }> = {
  rd: { name: '研发部', agents: ['analyst', 'architect', 'dev-lead', 'test-lead'] },
  marketing: { name: '市场部', agents: [] },
  finance: { name: '财务部', agents: [] },
};
