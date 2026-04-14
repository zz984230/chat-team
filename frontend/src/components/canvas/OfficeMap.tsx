import { Graphics } from '@pixi/react';
import { useCallback } from 'react';
import { Text } from '@pixi/text';
import type { Graphics as PixiGraphics } from '@pixi/graphics';
import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';

export function OfficeMap() {
  const draw = useCallback((g: PixiGraphics) => {
    g.clear();

    const { tileWidth, tileHeight, corridorColor, roomFloorColor, wallColor } = MAP_CONFIG;

    // Draw corridor background
    g.beginFill(corridorColor);
    g.drawRect(0, 0, MAP_CONFIG.mapWidth * tileWidth, MAP_CONFIG.mapHeight * tileHeight);
    g.endFill();

    // Draw rooms
    for (const room of ROOMS) {
      const { x, y, width, height } = room.bounds;

      // Floor
      g.beginFill(roomFloorColor);
      g.drawRect(x * tileWidth, y * tileHeight, width * tileWidth, height * tileHeight);
      g.endFill();

      // Walls
      g.lineStyle(3, wallColor, 1);
      g.drawRect(x * tileWidth, y * tileHeight, width * tileWidth, height * tileHeight);

      // Room label
      g.lineStyle(0);
    }
  }, []);

  const drawLabels = useCallback((g: PixiGraphics) => {
    g.clear();
    const { tileWidth, tileHeight } = MAP_CONFIG;

    for (const room of ROOMS) {
      const { x, y, width } = room.bounds;
      const label = new Text(room.name, {
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0x888899,
        align: 'center',
      });
      label.anchor.set(0.5);
      label.x = (x + width / 2) * tileWidth;
      label.y = (y + 0.5) * tileHeight;
      g.addChild(label);
    }
  }, []);

  return (
    <>
      <Graphics draw={draw} />
      <Graphics draw={drawLabels} />
    </>
  );
}
