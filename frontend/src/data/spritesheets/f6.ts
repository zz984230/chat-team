import type { ISpritesheetData } from 'pixi.js';

export const spritesheetData: ISpritesheetData = {
  frames: {
    'down-0': { frame: { x: 96, y: 128, w: 32, h: 32 } },
    'down-1': { frame: { x: 128, y: 128, w: 32, h: 32 } },
    'down-2': { frame: { x: 160, y: 128, w: 32, h: 32 } },
    'up-0': { frame: { x: 96, y: 224, w: 32, h: 32 } },
    'up-1': { frame: { x: 128, y: 224, w: 32, h: 32 } },
    'up-2': { frame: { x: 160, y: 224, w: 32, h: 32 } },
    'right-0': { frame: { x: 96, y: 192, w: 32, h: 32 } },
    'right-1': { frame: { x: 128, y: 192, w: 32, h: 32 } },
    'right-2': { frame: { x: 160, y: 192, w: 32, h: 32 } },
    'left-0': { frame: { x: 96, y: 160, w: 32, h: 32 } },
    'left-1': { frame: { x: 128, y: 160, w: 32, h: 32 } },
    'left-2': { frame: { x: 160, y: 160, w: 32, h: 32 } },
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
