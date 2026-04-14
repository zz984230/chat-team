import type { ISpritesheetData } from 'pixi.js';

export const spritesheetData: ISpritesheetData = {
  frames: {
    'down-0': { frame: { x: 0, y: 0, w: 16, h: 16 } },
    'down-1': { frame: { x: 16, y: 0, w: 16, h: 16 } },
    'down-2': { frame: { x: 32, y: 0, w: 16, h: 16 } },
    'up-0': { frame: { x: 0, y: 16, w: 16, h: 16 } },
    'up-1': { frame: { x: 16, y: 16, w: 16, h: 16 } },
    'up-2': { frame: { x: 32, y: 16, w: 16, h: 16 } },
    'right-0': { frame: { x: 0, y: 32, w: 16, h: 16 } },
    'right-1': { frame: { x: 16, y: 32, w: 16, h: 16 } },
    'right-2': { frame: { x: 32, y: 32, w: 16, h: 16 } },
    'left-0': { frame: { x: 0, y: 48, w: 16, h: 16 } },
    'left-1': { frame: { x: 16, y: 48, w: 16, h: 16 } },
    'left-2': { frame: { x: 32, y: 48, w: 16, h: 16 } },
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
