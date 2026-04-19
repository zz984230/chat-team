import { useEffect, useRef } from 'react';
import { Container, Graphics, BaseTexture, Texture } from 'pixi.js';
import { Tilemap } from '@pixi/tilemap';
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

/** Layer name to z-depth mapping */
const LAYER_DEPTH: Record<string, number> = {
  Floor: 0,
  Walls: 1,
  Furniture: 2,
  Foreground: 4,
};

/** Default depth for layers not in the mapping */
const DEFAULT_DEPTH = 2;

/** Depth for interaction overlay areas */
const INTERACTION_DEPTH = 3;

/**
 * TiledMap renders a Tiled JSON map using @pixi/tilemap.
 * Loads tileset textures, renders visible tile layers, and creates
 * interactive zones from objectgroup layers.
 */
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

    // Async load and render map
    loadTiledMap('/assets/maps/the_office.json')
      .then((mapData) => {
        if (destroyed) return;
        renderMap(root, mapData);
      })
      .catch((err) => {
        console.error('[TiledMap] Failed to load map:', err);
      });

    viewport.addChild(root);

    return () => {
      destroyed = true;
      viewport.removeChild(root);
      root.destroy({ children: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport]);

  /**
   * Renders the full map: tile layers and interaction zones.
   */
  function renderMap(root: Container, mapData: TiledMapData) {
    // Load BaseTextures for all tilesets
    const baseTextureMap = new Map<string, BaseTexture>();
    for (const tileset of mapData.tilesets) {
      // Image paths in JSON are like "../tilesets/Room_Builder_32x32.png"
      // relative to the map file at /assets/maps/. Resolve to "/assets/tilesets/..."
      const imagePath = resolveImagePath(tileset.image);
      const baseTexture = BaseTexture.from(imagePath);
      baseTextureMap.set(tileset.name, baseTexture);
    }

    // Render each layer
    for (const layer of mapData.layers) {
      if (!layer.visible) continue;

      if (layer.type === 'tilelayer' && layer.data) {
        renderTileLayer(root, mapData, layer.data, layer.name, layer.opacity, baseTextureMap);
      } else if (layer.type === 'objectgroup') {
        renderInteractionZones(root, layer);
      }
    }
  }

  /**
   * Renders a single tile layer using @pixi/tilemap.
   */
  function renderTileLayer(
    root: Container,
    mapData: TiledMapData,
    data: number[],
    layerName: string,
    opacity: number,
    baseTextureMap: Map<string, BaseTexture>,
  ) {
    // Collect unique base textures used in this layer
    const layerBaseTextures: BaseTexture[] = [];
    const textureIndexMap = new Map<string, number>();

    for (const tileset of mapData.tilesets) {
      const bt = baseTextureMap.get(tileset.name);
      if (bt) {
        textureIndexMap.set(tileset.name, layerBaseTextures.length);
        layerBaseTextures.push(bt);
      }
    }

    const tilemap = new Tilemap(layerBaseTextures);
    tilemap.alpha = opacity;

    const depth = LAYER_DEPTH[layerName] ?? DEFAULT_DEPTH;

    // Cache textures by gid to avoid re-creating identical ones
    const textureCache = new Map<number, Texture>();

    for (let i = 0; i < data.length; i++) {
      const gid = data[i];
      if (gid === undefined || gid === 0) continue;

      const tileset = findTilesetForGid(mapData.tilesets, gid);
      if (!tileset) continue;

      const baseTexture = baseTextureMap.get(tileset.name);
      if (!baseTexture) continue;

      const col = i % mapData.width;
      const row = Math.floor(i / mapData.width);
      const x = col * mapData.tileWidth;
      const y = row * mapData.tileHeight;

      // Reuse texture if already created for this gid
      let texture = textureCache.get(gid);
      if (!texture) {
        const sourceRect = resolveTileSourceRect(tileset, gid);
        texture = new Texture(baseTexture, sourceRect);
        textureCache.set(gid, texture);
      }

      // Extract frame values (Rectangle props may be typed as number | undefined)
      const frame = texture.frame;
      const u = frame.x;
      const v = frame.y;
      const tw = frame.width;
      const th = frame.height;

      // Use the base texture index as the tile texture identifier
      const texIndex = textureIndexMap.get(tileset.name) ?? 0;
      tilemap.tile(
        texIndex,
        x,
        y,
        {
          u: u ?? 0,
          v: v ?? 0,
          tileWidth: tw ?? mapData.tileWidth,
          tileHeight: th ?? mapData.tileHeight,
        },
      );
    }

    root.addChildAt(tilemap, Math.min(depth, root.children.length));
  }

  /**
   * Renders interactive zones from an objectgroup layer.
   */
  function renderInteractionZones(
    root: Container,
    layer: { objects?: InteractionZone[] | any[]; name?: string },
  ) {
    const zones = parseInteractables(layer as any);
    if (zones.length === 0) return;

    for (const zone of zones) {
      const hitArea = new Container();
      hitArea.eventMode = 'static';
      hitArea.cursor = 'pointer';

      // Determine interaction type from the zone name
      const isTask = zone.name.toLowerCase().includes('task');
      const isArchive = zone.name.toLowerCase().includes('archive');

      if (isTask) {
        // Elliptical hit area with yellow glow
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
          if (activeSessionRef.current && activeSessionRef.current.status === 'running') {
            return;
          }
          if (zone.roomId) {
            openNewTask(zone.roomId);
          }
        });
      } else if (isArchive) {
        // Rectangular hit area with white highlight
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
          if (zone.roomId) {
            openArchive(zone.roomId);
          }
        });
      }

      root.addChildAt(hitArea, Math.min(INTERACTION_DEPTH, root.children.length));
    }
  }

  /**
   * Resolves a Tiled image path to a web-accessible URL.
   * Tiled JSON stores relative paths like "../tilesets/foo.png"
   * relative to the map file location (assets/maps/).
   * This resolves them to "/assets/tilesets/foo.png".
   */
  function resolveImagePath(imagePath: string): string {
    // Handle "../tilesets/X.png" -> "/assets/tilesets/X.png"
    // Also handle "tilesets/X.png" -> "/assets/tilesets/X.png"
    const normalized = imagePath.replace(/\.\.\//g, '').replace(/^\.\//, '');
    return `/assets/${normalized}`;
  }

  return null;
}
