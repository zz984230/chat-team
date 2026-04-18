export interface FurnitureItem {
  type: 'desk' | 'chair' | 'whiteboard' | 'screen' | 'bookshelf' | 'cabinet' | 'lamp' | 'round_table' | 'covered';
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}

export interface RoomDef {
  id: string;
  name: string;
  phase: number | null;
  agents: string[];
  bounds: { x: number; y: number; width: number; height: number };
  seats: Record<string, { x: number; y: number }>;
  floorColor: number;
  status: 'active' | 'renovating';
  furniture: FurnitureItem[];
}

// 24x18 tile map (768x576 pixels)
// Layout: T-shaped corridor connecting 3 rooms
//   rd (top center), marketing (bottom left), finance (bottom right)

export const ROOMS: RoomDef[] = [
  {
    id: 'rd',
    name: '研发部',
    phase: 1,
    agents: ['analyst', 'architect', 'dev-lead', 'test-lead'],
    bounds: { x: 7, y: 0, width: 10, height: 9 },
    seats: {
      analyst: { x: 11, y: 3 },
      architect: { x: 14, y: 5 },
      'dev-lead': { x: 11, y: 7 },
      'test-lead': { x: 8, y: 5 },
    },
    floorColor: 0x1a2e1a,
    status: 'active',
    furniture: [
      { type: 'round_table', x: 10, y: 4, width: 3, height: 3, color: 0x6b5b47 },
      { type: 'chair', x: 11, y: 3, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 14, y: 5, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 11, y: 7, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 8, y: 5, width: 1, height: 1, color: 0x555566 },
      { type: 'whiteboard', x: 16, y: 2, width: 1, height: 4, color: 0xeeeeee },
      { type: 'screen', x: 11, y: 0, width: 2, height: 1, color: 0x334455 },
    ],
  },
  {
    id: 'marketing',
    name: '市场部',
    phase: null,
    agents: [],
    bounds: { x: 0, y: 12, width: 9, height: 6 },
    seats: {},
    floorColor: 0x2a2a3a,
    status: 'renovating',
    furniture: [
      { type: 'covered', x: 1, y: 13, width: 3, height: 1, color: 0x444444 },
      { type: 'covered', x: 5, y: 13, width: 2, height: 1, color: 0x444444 },
      { type: 'covered', x: 1, y: 15, width: 2, height: 1, color: 0x444444 },
    ],
  },
  {
    id: 'finance',
    name: '财务部',
    phase: null,
    agents: [],
    bounds: { x: 15, y: 12, width: 9, height: 6 },
    seats: {},
    floorColor: 0x2a2a3a,
    status: 'renovating',
    furniture: [
      { type: 'covered', x: 16, y: 13, width: 3, height: 1, color: 0x444444 },
      { type: 'covered', x: 20, y: 13, width: 2, height: 1, color: 0x444444 },
      { type: 'covered', x: 16, y: 15, width: 2, height: 1, color: 0x444444 },
    ],
  },
];

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
