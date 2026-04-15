export interface FurnitureItem {
  type: 'desk' | 'chair' | 'whiteboard' | 'screen' | 'bookshelf' | 'cabinet' | 'lamp';
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
  furniture: FurnitureItem[];
}

export const ROOMS: RoomDef[] = [
  {
    id: 'meeting',
    name: '会议室',
    phase: 1,
    agents: ['analyst'],
    bounds: { x: 0, y: 0, width: 10, height: 8 },
    seats: { analyst: { x: 5, y: 5 } },
    floorColor: 0x3d3530,
    furniture: [
      { type: 'desk', x: 3, y: 3, width: 4, height: 2, color: 0x6b5b47 },
      { type: 'chair', x: 3, y: 2, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 5, y: 2, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 3, y: 5, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 5, y: 5, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 2, y: 3, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 7, y: 4, width: 1, height: 1, color: 0x555566 },
      { type: 'whiteboard', x: 9, y: 2, width: 1, height: 4, color: 0xeeeeee },
      { type: 'screen', x: 4, y: 0, width: 2, height: 1, color: 0x334455 },
    ],
  },
  {
    id: 'design',
    name: '设计中心',
    phase: 2,
    agents: ['architect', 'researcher'],
    bounds: { x: 10, y: 0, width: 10, height: 8 },
    seats: { architect: { x: 13, y: 4 }, researcher: { x: 17, y: 4 } },
    floorColor: 0x303840,
    furniture: [
      { type: 'desk', x: 12, y: 3, width: 3, height: 1, color: 0x6b5b47 },
      { type: 'desk', x: 16, y: 3, width: 3, height: 1, color: 0x6b5b47 },
      { type: 'chair', x: 13, y: 4, width: 1, height: 1, color: 0x555566 },
      { type: 'chair', x: 17, y: 4, width: 1, height: 1, color: 0x555566 },
      { type: 'screen', x: 14, y: 0, width: 3, height: 1, color: 0x334455 },
      { type: 'whiteboard', x: 19, y: 2, width: 1, height: 4, color: 0xeeeeee },
    ],
  },
  {
    id: 'writing',
    name: '撰写区',
    phase: 3,
    agents: ['writer'],
    bounds: { x: 0, y: 8, width: 10, height: 8 },
    seats: { writer: { x: 5, y: 12 } },
    floorColor: 0x2d3a2d,
    furniture: [
      { type: 'desk', x: 4, y: 11, width: 2, height: 1, color: 0x6b5b47 },
      { type: 'chair', x: 5, y: 12, width: 1, height: 1, color: 0x555566 },
      { type: 'bookshelf', x: 0, y: 9, width: 1, height: 6, color: 0x5a4a3a },
      { type: 'lamp', x: 6, y: 11, width: 1, height: 1, color: 0xffdd88 },
    ],
  },
  {
    id: 'archive',
    name: '档案柜',
    phase: null,
    agents: [],
    bounds: { x: 10, y: 8, width: 10, height: 8 },
    seats: {},
    floorColor: 0x383838,
    furniture: [
      { type: 'cabinet', x: 11, y: 9, width: 1, height: 2, color: 0x666655 },
      { type: 'cabinet', x: 11, y: 11, width: 1, height: 2, color: 0x666655 },
      { type: 'cabinet', x: 11, y: 13, width: 1, height: 2, color: 0x666655 },
      { type: 'cabinet', x: 18, y: 9, width: 1, height: 2, color: 0x666655 },
      { type: 'cabinet', x: 18, y: 11, width: 1, height: 2, color: 0x666655 },
      { type: 'whiteboard', x: 13, y: 8, width: 4, height: 1, color: 0xcc9966 },
      { type: 'desk', x: 14, y: 12, width: 2, height: 2, color: 0x6b5b47 },
    ],
  },
];

export const MAP_CONFIG = {
  tileWidth: 32,
  tileHeight: 32,
  mapWidth: 20,
  mapHeight: 16,
  corridorColor: 0x2a2a3a,
  wallColor: 0x1a1a2a,
  wallThickness: 3,
};
