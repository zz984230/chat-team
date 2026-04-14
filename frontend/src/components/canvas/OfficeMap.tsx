import { Graphics } from '@pixi/react';
import { useCallback } from 'react';
import { Text } from '@pixi/text';
import type { Graphics as PixiGraphics } from '@pixi/graphics';
import { Rectangle } from '@pixi/math';
import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';
import { useUiStore } from '../../stores/uiStore';

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
      <RoomInteractionLayer />
    </>
  );
}

function RoomInteractionLayer() {
  const openArchive = useUiStore((s) => s.openArchiveDrawer);

  return (
    <>
      {ROOMS.map((room) => {
        if (room.id !== 'archive') return null;
        const { x, y, width, height } = room.bounds;
        return (
          <InteractiveRoom
            key={room.id}
            x={x * MAP_CONFIG.tileWidth}
            y={y * MAP_CONFIG.tileHeight}
            width={width * MAP_CONFIG.tileWidth}
            height={height * MAP_CONFIG.tileHeight}
            onClick={openArchive}
          />
        );
      })}
    </>
  );
}

function InteractiveRoom({
  x, y, width, height, onClick,
}: {
  x: number; y: number; width: number; height: number;
  onClick: () => void;
}) {
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0xffffff, 0.01);
      g.drawRect(0, 0, width, height);
      g.endFill();
      g.hitArea = new Rectangle(0, 0, width, height);
      g.cursor = 'pointer';
    },
    [width, height],
  );

  return <Graphics draw={draw} x={x} y={y} interactive pointerdown={onClick} />;
}
