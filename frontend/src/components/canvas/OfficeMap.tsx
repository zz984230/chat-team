import { useEffect } from 'react';
import { Graphics } from 'pixi.js';
import { Text } from '@pixi/text';
import { Rectangle } from '@pixi/math';
import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';
import { useViewport } from './PixiCanvas';
import { useUiStore } from '../../stores/uiStore';
import type { FurnitureItem } from '../../data/mapConfig';

const { tileWidth, tileHeight, mapWidth, mapHeight, corridorColor, wallColor, wallThickness } = MAP_CONFIG;

function drawDesk(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth + 2;
  const py = item.y * tileHeight + 2;
  const pw = item.width * tileWidth - 4;
  const ph = item.height * tileHeight - 4;
  g.beginFill(item.color);
  g.drawRoundedRect(px, py, pw, ph, 2);
  g.endFill();
}

function drawChair(g: Graphics, item: FurnitureItem) {
  const cx = (item.x + item.width / 2) * tileWidth;
  const cy = (item.y + item.height / 2) * tileHeight;
  const radius = (Math.min(item.width * tileWidth, item.height * tileHeight) / 2) * 0.6;
  g.beginFill(item.color);
  g.drawCircle(cx, cy, radius);
  g.endFill();
}

function drawWhiteboard(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth;
  const py = item.y * tileHeight;
  const pw = item.width * tileWidth;
  const ph = item.height * tileHeight;
  g.beginFill(item.color);
  g.drawRect(px, py, pw, ph);
  g.endFill();
  // Glass effect - semi-transparent inner rectangle
  g.beginFill(0xffffff, 0.15);
  g.drawRect(px + 2, py + 2, pw - 4, ph - 4);
  g.endFill();
}

function drawScreen(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth;
  const py = item.y * tileHeight;
  const pw = item.width * tileWidth;
  const ph = item.height * tileHeight;
  g.beginFill(item.color);
  g.drawRect(px, py, pw, ph);
  g.endFill();
  // Screen glow - light blue tinted inner rectangle
  g.beginFill(0x88bbff, 0.3);
  g.drawRect(px + 2, py + 2, pw - 4, ph - 4);
  g.endFill();
}

function drawBookshelf(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth;
  const py = item.y * tileHeight;
  const pw = item.width * tileWidth;
  const ph = item.height * tileHeight;
  g.beginFill(item.color);
  g.drawRect(px, py, pw, ph);
  g.endFill();
  // Horizontal lines at 16px intervals
  g.lineStyle(1, 0x000000, 0.3);
  const startY = py + 16;
  for (let ly = startY; ly < py + ph; ly += 16) {
    g.moveTo(px, ly);
    g.lineTo(px + pw, ly);
  }
  g.lineStyle(0);
}

function drawCabinet(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth;
  const py = item.y * tileHeight;
  const pw = item.width * tileWidth;
  const ph = item.height * tileHeight;
  // Filled rectangle with 1px inset
  g.beginFill(item.color);
  g.drawRect(px + 1, py + 1, pw - 2, ph - 2);
  g.endFill();
  // Small circle handle in center
  g.beginFill(0x999988);
  g.drawCircle(px + pw / 2, py + ph / 2, 3);
  g.endFill();
}

function drawLamp(g: Graphics, item: FurnitureItem) {
  const cx = (item.x + item.width / 2) * tileWidth;
  const cy = (item.y + item.height / 2) * tileHeight;
  // Larger semi-transparent glow circle
  g.beginFill(item.color, 0.2);
  g.drawCircle(cx, cy, Math.min(item.width * tileWidth, item.height * tileHeight) * 0.45);
  g.endFill();
  // Filled circle
  g.beginFill(item.color);
  g.drawCircle(cx, cy, 4);
  g.endFill();
}

function drawFurniture(g: Graphics, item: FurnitureItem) {
  switch (item.type) {
    case 'desk':
      drawDesk(g, item);
      break;
    case 'chair':
      drawChair(g, item);
      break;
    case 'whiteboard':
      drawWhiteboard(g, item);
      break;
    case 'screen':
      drawScreen(g, item);
      break;
    case 'bookshelf':
      drawBookshelf(g, item);
      break;
    case 'cabinet':
      drawCabinet(g, item);
      break;
    case 'lamp':
      drawLamp(g, item);
      break;
  }
}

export function OfficeMap() {
  const viewport = useViewport();
  const openArchiveDrawer = useUiStore((s) => s.openArchiveDrawer);

  useEffect(() => {
    if (!viewport) return;

    const container = new Graphics();

    // 1. Corridor background (entire map area)
    container.beginFill(corridorColor);
    container.drawRect(0, 0, mapWidth * tileWidth, mapHeight * tileHeight);
    container.endFill();

    // 2. Draw each room
    for (const room of ROOMS) {
      const { x, y, width, height } = room.bounds;
      const rx = x * tileWidth;
      const ry = y * tileHeight;
      const rw = width * tileWidth;
      const rh = height * tileHeight;

      // Floor with room-specific color
      container.beginFill(room.floorColor);
      container.drawRect(rx, ry, rw, rh);
      container.endFill();

      // Walls
      container.lineStyle(wallThickness, wallColor, 1);
      container.drawRect(rx, ry, rw, rh);
      container.lineStyle(0);

      // Furniture
      for (const item of room.furniture) {
        drawFurniture(container, item);
      }

      // Room name label
      const label = new Text(room.name, {
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0x888899,
        align: 'center',
      });
      label.anchor.set(0.5);
      label.x = (x + width / 2) * tileWidth;
      label.y = (y + 0.5) * tileHeight;
      container.addChild(label);
    }

    viewport.addChild(container);

    // 3. Click-interactive layer over archive room
    const archiveRoom = ROOMS.find((r) => r.id === 'archive');
    let hitArea: Graphics | null = null;
    if (archiveRoom) {
      const { x, y, width, height } = archiveRoom.bounds;
      hitArea = new Graphics();
      hitArea.beginFill(0xffffff, 0.01);
      hitArea.drawRect(x * tileWidth, y * tileHeight, width * tileWidth, height * tileHeight);
      hitArea.endFill();
      hitArea.hitArea = new Rectangle(
        x * tileWidth,
        y * tileHeight,
        width * tileWidth,
        height * tileHeight,
      );
      hitArea.cursor = 'pointer';
      hitArea.eventMode = 'static';
      hitArea.on('pointerdown', openArchiveDrawer);
      viewport.addChild(hitArea);
    }

    return () => {
      if (hitArea) {
        hitArea.off('pointerdown', openArchiveDrawer);
        viewport.removeChild(hitArea);
        hitArea.destroy();
      }
      viewport.removeChild(container);
      container.destroy({ children: true });
    };
  }, [viewport, openArchiveDrawer]);

  return null;
}
