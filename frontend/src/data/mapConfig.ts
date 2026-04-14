export interface RoomDef {
  id: string;
  name: string;
  phase: number | null;
  agents: string[];
  bounds: { x: number; y: number; width: number; height: number };
  seats: Record<string, { x: number; y: number }>;
}

export const ROOMS: RoomDef[] = [
  {
    id: 'meeting',
    name: '会议室',
    phase: 1,
    agents: ['analyst'],
    bounds: { x: 0, y: 0, width: 10, height: 8 },
    seats: { analyst: { x: 5, y: 5 } },
  },
  {
    id: 'design',
    name: '设计中心',
    phase: 2,
    agents: ['architect', 'researcher'],
    bounds: { x: 10, y: 0, width: 10, height: 8 },
    seats: { architect: { x: 13, y: 4 }, researcher: { x: 17, y: 4 } },
  },
  {
    id: 'writing',
    name: '撰写区',
    phase: 3,
    agents: ['writer'],
    bounds: { x: 0, y: 8, width: 10, height: 8 },
    seats: { writer: { x: 5, y: 12 } },
  },
  {
    id: 'archive',
    name: '档案柜',
    phase: null,
    agents: [],
    bounds: { x: 10, y: 8, width: 10, height: 8 },
    seats: {},
  },
];

export const MAP_CONFIG = {
  tileWidth: 32,
  tileHeight: 32,
  mapWidth: 20,
  mapHeight: 16,
  corridorColor: 0x4a4a5a,
  roomFloorColor: 0x3a3a4a,
  wallColor: 0x2a2a3a,
};
