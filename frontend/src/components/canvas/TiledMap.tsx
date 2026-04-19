import { useEffect, useRef } from 'react';
import { Container, Graphics, BaseTexture, Texture, Sprite } from 'pixi.js';
import { useViewport } from './PixiCanvas';
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import {
  loadTiledMap,
  findTilesetForGid,
  resolveTileSourceRect,
  parseInteractables,
} from '../../utils/tmxLoader';
import type { TiledMapData, InteractionZone } from '../../utils/tmxLoader';

const LAYER_DEPTH: Record<string, number> = {
  Floor: 0,
  Walls: 1,
  Furniture: 2,
  Foreground: 4,
};
const DEFAULT_DEPTH = 2;
const INTERACTION_DEPTH = 3;

export function TiledMap() {
  const viewport = useViewport();
  const openNewTask = useUiStore((s) => s.openNewTaskModal);
  const openArchive = useUiStore((s) => s.openRoomArchive);
  const activeSession = useSessionStore((s) => s.activeSession);
  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;

  useEffect(() => {
    if (!viewport) return;

    let destroyed = false;
    const root = new Container();

    loadAndRender(root);

    async function loadAndRender(root: Container) {
      try {
        const mapData = await loadTiledMap('/assets/maps/the_office.json');
        if (destroyed) return;

        const baseTextures = new Map<string, BaseTexture>();
        const loadPromises: Promise<void>[] = [];

        for (const tileset of mapData.tilesets) {
          const imagePath = resolveImagePath(tileset.image);
          const bt = BaseTexture.from(imagePath);
          baseTextures.set(tileset.name, bt);

          if (!bt.valid) {
            loadPromises.push(
              new Promise<void>((resolve) => {
                bt.once('loaded', () => resolve());
                bt.once('error', () => resolve());
              }),
            );
          }
        }

        if (loadPromises.length > 0) {
          await Promise.all(loadPromises);
        }
        if (destroyed) return;

        for (const layer of mapData.layers) {
          if (!layer.visible) continue;

          if (layer.type === 'tilelayer' && layer.data) {
            renderTileLayer(root, mapData, layer.data, layer.name, layer.opacity, baseTextures);
          } else if (layer.type === 'objectgroup') {
            renderInteractionZones(root, layer);
          }
        }
      } catch (err) {
        console.error('[TiledMap] Failed:', err);
      }
    }

    viewport.addChild(root);

    return () => {
      destroyed = true;
      viewport.removeChild(root);
      root.destroy({ children: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport]);

  function renderTileLayer(
    root: Container,
    mapData: TiledMapData,
    data: number[],
    layerName: string,
    opacity: number,
    baseTextures: Map<string, BaseTexture>,
  ) {
    const layerContainer = new Container();
    layerContainer.alpha = opacity;

    const textureCache = new Map<number, Texture>();

    for (let i = 0; i < data.length; i++) {
      const gid = data[i];
      if (gid === 0) continue;

      const tileset = findTilesetForGid(mapData.tilesets, gid);
      if (!tileset) continue;

      const bt = baseTextures.get(tileset.name);
      if (!bt) continue;

      let texture = textureCache.get(gid);
      if (!texture) {
        const rect = resolveTileSourceRect(tileset, gid);
        texture = new Texture(bt, rect);
        textureCache.set(gid, texture);
      }

      const col = i % mapData.width;
      const row = Math.floor(i / mapData.width);
      const sprite = new Sprite(texture);
      sprite.x = col * mapData.tileWidth;
      sprite.y = row * mapData.tileHeight;
      layerContainer.addChild(sprite);
    }

    const depth = LAYER_DEPTH[layerName] ?? DEFAULT_DEPTH;
    root.addChildAt(layerContainer, Math.min(depth, root.children.length));
  }

  function renderInteractionZones(root: Container, layer: any) {
    const zones = parseInteractables(layer);
    if (zones.length === 0) return;

    for (const zone of zones) {
      const hitArea = new Container();
      hitArea.eventMode = 'static';
      hitArea.cursor = 'pointer';

      const isTask = zone.type === 'task' || zone.name.toLowerCase().includes('task');
      const isArchive = zone.type === 'archive' || zone.name.toLowerCase().includes('archive');

      if (isTask) {
        const cx = zone.x + zone.width / 2;
        const cy = zone.y + zone.height / 2;
        const rx = zone.width / 2;
        const ry = zone.height / 2;

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
          if (activeSessionRef.current?.status === 'running') return;
          if (zone.roomId) openNewTask(zone.roomId);
        });
      } else if (isArchive) {
        const hit = new Graphics();
        hit.beginFill(0xffffff, 0);
        hit.drawRect(zone.x, zone.y, zone.width, zone.height);
        hit.endFill();
        hitArea.addChild(hit);

        const highlight = new Graphics();
        highlight.beginFill(0xffffff, 0.15);
        highlight.drawRoundedRect(zone.x + 1, zone.y + 1, zone.width - 2, zone.height - 2, 2);
        highlight.endFill();
        highlight.alpha = 0;
        hitArea.addChild(highlight);

        hitArea.on('pointerover', () => { highlight.alpha = 1; });
        hitArea.on('pointerout', () => { highlight.alpha = 0; });
        hitArea.on('pointerdown', () => {
          if (zone.roomId) openArchive(zone.roomId);
        });
      }

      root.addChildAt(hitArea, Math.min(INTERACTION_DEPTH, root.children.length));
    }
  }

  return null;
}

function resolveImagePath(imagePath: string): string {
  const normalized = imagePath.replace(/\.\.\//g, '').replace(/^\.\//, '');
  return `/assets/${normalized}`;
}
