import type { ISpritesheetData } from 'pixi.js';

export const spritesheetData: ISpritesheetData = {
  frames: {
    'down-0': { frame: { x: 0, y: 0, w: 32, h: 32 } },
    'down-1': { frame: { x: 32, y: 0, w: 32, h: 32 } },
    'down-2': { frame: { x: 64, y: 0, w: 32, h: 32 } },
    'up-0': { frame: { x: 0, y: 96, w: 32, h: 32 } },
    'up-1': { frame: { x: 32, y: 96, w: 32, h: 32 } },
    'up-2': { frame: { x: 64, y: 96, w: 32, h: 32 } },
    'right-0': { frame: { x: 0, y: 64, w: 32, h: 32 } },
    'right-1': { frame: { x: 32, y: 64, w: 32, h: 32 } },
    'right-2': { frame: { x: 64, y: 64, w: 32, h: 32 } },
    'left-0': { frame: { x: 0, y: 32, w: 32, h: 32 } },
    'left-1': { frame: { x: 32, y: 32, w: 32, h: 32 } },
    'left-2': { frame: { x: 64, y: 32, w: 32, h: 32 } },
  },
  animations: {
    'down': ['down-0', 'down-1', 'down-2'],
    'up': ['up-0', 'up-1', 'up-2'],
    'right': ['right-0', 'right-1', 'right-2'],
    'left': ['left-0', 'left-1', 'left-2'],
  },
  meta: {
    scale: '1',
  },
};
