import { useEffect, useRef } from 'react';
import { Graphics, Container } from 'pixi.js';
import { Text } from '@pixi/text';
import { ROOMS, MAP_CONFIG } from '../../data/mapConfig';
import { useViewport } from './PixiCanvas';
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
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
  g.beginFill(0x88bbff, 0.3);
  g.drawRect(px + 2, py + 2, pw - 4, ph - 4);
  g.endFill();
}

function drawRoundTable(g: Graphics, item: FurnitureItem) {
  const cx = (item.x + item.width / 2) * tileWidth;
  const cy = (item.y + item.height / 2) * tileHeight;
  const rx = (item.width * tileWidth) / 2 - 4;
  const ry = (item.height * tileHeight) / 2 - 4;
  g.beginFill(item.color);
  g.drawEllipse(cx, cy, rx, ry);
  g.endFill();
  g.beginFill(0x7d6d57, 0.3);
  g.drawEllipse(cx, cy, rx * 0.7, ry * 0.7);
  g.endFill();
}

function drawCovered(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth;
  const py = item.y * tileHeight;
  const pw = item.width * tileWidth;
  const ph = item.height * tileHeight;
  g.beginFill(item.color);
  g.drawRoundedRect(px + 1, py + 1, pw - 2, ph - 2, 2);
  g.endFill();
  g.lineStyle(1, 0x555555, 0.4);
  const midY = py + ph / 2;
  g.moveTo(px + 3, midY - 3);
  g.lineTo(px + pw - 3, midY - 3);
  g.moveTo(px + 3, midY + 3);
  g.lineTo(px + pw - 3, midY + 3);
  g.lineStyle(0);
}

function drawCabinet(g: Graphics, item: FurnitureItem) {
  const px = item.x * tileWidth;
  const py = item.y * tileHeight;
  const pw = item.width * tileWidth;
  const ph = item.height * tileHeight;

  // Cabinet body
  g.beginFill(item.color);
  g.drawRoundedRect(px + 1, py + 1, pw - 2, ph - 2, 2);
  g.endFill();

  // Drawer lines and handles
  const drawerCount = 3;
  const drawerH = (ph - 4) / drawerCount;
  for (let i = 0; i < drawerCount; i++) {
    const dy = py + 2 + i * drawerH;
    g.lineStyle(1, 0x6b5b47, 0.5);
    g.moveTo(px + 3, dy + drawerH - 1);
    g.lineTo(px + pw - 3, dy + drawerH - 1);

    // Handle
    g.beginFill(0xccaa88, 0.6);
    g.drawRoundedRect(px + pw / 2 - 3, dy + drawerH / 2 - 1, 6, 2, 1);
    g.endFill();
  }
  g.lineStyle(0);
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
    case 'round_table':
      drawRoundTable(g, item);
      break;
    case 'covered':
      drawCovered(g, item);
      break;
    case 'cabinet':
      drawCabinet(g, item);
      break;
  }
}

export function OfficeMap() {
  const viewport = useViewport();
  const openNewTask = useUiStore((s) => s.openNewTaskModal);
  const openArchive = useUiStore((s) => s.openRoomArchive);
  const activeSession = useSessionStore((s) => s.activeSession);
  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;

  useEffect(() => {
    if (!viewport) return;

    const container = new Graphics();

    // 1. Corridor background (entire map area)
    container.beginFill(corridorColor);
    container.drawRect(0, 0, mapWidth * tileWidth, mapHeight * tileHeight);
    container.endFill();

    // 2. T-shaped corridor
    container.beginFill(corridorColor);
    container.drawRect(10 * tileWidth, 9 * tileHeight, 4 * tileWidth, 3 * tileHeight);
    container.endFill();
    container.beginFill(corridorColor);
    container.drawRect(0, 10 * tileHeight, mapWidth * tileWidth, 2 * tileHeight);
    container.endFill();

    // 3. Company name
    const companyLabel = new Text(MAP_CONFIG.companyName, {
      fontFamily: 'sans-serif',
      fontSize: 18,
      fill: 0x667788,
      fontWeight: 'bold',
      align: 'center',
    });
    companyLabel.anchor.set(0.5);
    companyLabel.x = (mapWidth / 2) * tileWidth;
    companyLabel.y = -12;
    container.addChild(companyLabel);

    // 4. Draw each room
    for (const room of ROOMS) {
      const { x, y, width, height } = room.bounds;
      const rx = x * tileWidth;
      const ry = y * tileHeight;
      const rw = width * tileWidth;
      const rh = height * tileHeight;

      container.beginFill(room.floorColor);
      container.drawRect(rx, ry, rw, rh);
      container.endFill();

      if (room.status === 'renovating') {
        container.lineStyle(wallThickness, wallColor, 0.5);
        container.drawRect(rx, ry, rw, rh);
        container.lineStyle(0);

        container.beginFill(0x000000, 0.2);
        container.drawRect(rx, ry, rw, rh);
        container.endFill();

        for (const item of room.furniture) {
          drawFurniture(container, item);
        }

        const sign = new Text('🔒 装修中', {
          fontFamily: 'sans-serif',
          fontSize: 12,
          fill: 0x888888,
          align: 'center',
        });
        sign.anchor.set(0.5);
        sign.x = (x + width / 2) * tileWidth;
        sign.y = (y + height / 2) * tileHeight;
        container.addChild(sign);

        const label = new Text(room.name, {
          fontFamily: 'sans-serif',
          fontSize: 11,
          fill: 0x666666,
          align: 'center',
        });
        label.anchor.set(0.5);
        label.x = (x + width / 2) * tileWidth;
        label.y = (y + height / 2 + 1) * tileHeight;
        container.addChild(label);
      } else {
        container.lineStyle(wallThickness, wallColor, 1);
        container.drawRect(rx, ry, rw, rh);
        container.lineStyle(0);

        for (const item of room.furniture) {
          drawFurniture(container, item);
        }

        const label = new Text(room.name, {
          fontFamily: 'sans-serif',
          fontSize: 14,
          fill: 0x88aa88,
          align: 'center',
        });
        label.anchor.set(0.5);
        label.x = (x + width / 2) * tileWidth;
        label.y = (y + 1.5) * tileHeight;
        container.addChild(label);
      }
    }

    // Interactive furniture hit areas (active rooms only)
    for (const room of ROOMS) {
      if (room.status !== 'active') continue;

      for (const item of room.furniture) {
        if (!item.interactive) continue;

        const hitArea = new Container();
        hitArea.eventMode = 'static';
        hitArea.cursor = 'pointer';

        if (item.interactive === 'task') {
          const cx = (item.x + item.width / 2) * tileWidth;
          const cy = (item.y + item.height / 2) * tileHeight;
          const rx = (item.width * tileWidth) / 2;
          const ry = (item.height * tileHeight) / 2;

          const hit = new Graphics();
          hit.beginFill(0xffffff, 0);
          hit.drawEllipse(cx, cy, rx, ry);
          hit.endFill();
          hitArea.addChild(hit);

          const glow = new Graphics();
          glow.beginFill(0xffff00, 0.15);
          glow.drawEllipse(cx, cy, rx, ry);
          glow.endFill();
          glow.alpha = 0;
          hitArea.addChild(glow);

          hitArea.on('pointerover', () => { glow.alpha = 1; });
          hitArea.on('pointerout', () => { glow.alpha = 0; });

          hitArea.on('pointerdown', () => {
            if (activeSessionRef.current && activeSessionRef.current.status === 'running') {
              return;
            }
            openNewTask(room.id);
          });
        } else if (item.interactive === 'archive') {
          const px = item.x * tileWidth;
          const py = item.y * tileHeight;
          const pw = item.width * tileWidth;
          const ph = item.height * tileHeight;

          const hit = new Graphics();
          hit.beginFill(0xffffff, 0);
          hit.drawRect(px, py, pw, ph);
          hit.endFill();
          hitArea.addChild(hit);

          const highlight = new Graphics();
          highlight.beginFill(0xffffff, 0.15);
          highlight.drawRoundedRect(px + 1, py + 1, pw - 2, ph - 2, 2);
          highlight.endFill();
          highlight.alpha = 0;
          hitArea.addChild(highlight);

          hitArea.on('pointerover', () => { highlight.alpha = 1; });
          hitArea.on('pointerout', () => { highlight.alpha = 0; });

          hitArea.on('pointerdown', () => {
            openArchive(room.id);
          });
        }

        container.addChild(hitArea);
      }
    }

    viewport.addChild(container);

    return () => {
      viewport.removeChild(container);
      container.destroy({ children: true });
    };
  }, [viewport, openNewTask, openArchive]);

  return null;
}
