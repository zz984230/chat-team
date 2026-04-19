import { describe, it, expect } from 'vitest';
import {
  parseTiledMap,
  resolveTileSourceRect,
  findTilesetForGid,
  parseInteractables,
  type TiledTileset,
  type TiledLayer,
} from '../../src/utils/tmxLoader';
import { Rectangle } from '@pixi/math';

// ---------------------------------------------------------------------------
// Sample Tiled JSON used across tests
// ---------------------------------------------------------------------------
const sampleTiledJson = {
  width: 20,
  height: 15,
  tilewidth: 16,
  tileheight: 16,
  tilesets: [
    {
      firstgid: 1,
      name: 'floors',
      tilewidth: 16,
      tileheight: 16,
      columns: 8,
      image: 'floors.png',
      imagewidth: 128,
      imageheight: 64,
    },
    {
      firstgid: 33,
      name: 'walls',
      tilewidth: 16,
      tileheight: 16,
      columns: 8,
      image: 'walls.png',
      imagewidth: 128,
      imageheight: 128,
    },
  ],
  layers: [
    {
      name: 'ground',
      type: 'tilelayer',
      data: [1, 2, 3, 0, 33, 34],
      visible: true,
      opacity: 1,
    },
    {
      name: 'interactables',
      type: 'objectgroup',
      objects: [
        {
          id: 1,
          name: 'task_board',
          type: 'task',
          x: 48,
          y: 80,
          width: 32,
          height: 32,
          properties: { roomId: 'meeting' },
        },
        {
          id: 2,
          name: 'archive_cabinet',
          type: 'archive',
          x: 200,
          y: 150,
          width: 32,
          height: 64,
          properties: { roomId: 'archive' },
        },
      ],
      visible: true,
      opacity: 1,
    },
  ],
};

describe('parseTiledMap', () => {
  it('parses valid Tiled JSON and maps field names correctly', () => {
    const map = parseTiledMap(sampleTiledJson);

    // Top-level dimension fields mapped from lowercase to camelCase
    expect(map.width).toBe(20);
    expect(map.height).toBe(15);
    expect(map.tileWidth).toBe(16);
    expect(map.tileHeight).toBe(16);

    // Tilesets
    expect(map.tilesets).toHaveLength(2);
    expect(map.tilesets[0].name).toBe('floors');
    expect(map.tilesets[0].firstgid).toBe(1);
    expect(map.tilesets[0].columns).toBe(8);
    expect(map.tilesets[0].imageWidth).toBe(128);
    expect(map.tilesets[0].imageHeight).toBe(64);
    expect(map.tilesets[1].name).toBe('walls');
    expect(map.tilesets[1].firstgid).toBe(33);

    // Layers
    expect(map.layers).toHaveLength(2);
    expect(map.layers[0].name).toBe('ground');
    expect(map.layers[0].type).toBe('tilelayer');
    expect(map.layers[0].data).toEqual([1, 2, 3, 0, 33, 34]);
  });

  it('handles objectgroup layers with objects', () => {
    const map = parseTiledMap(sampleTiledJson);

    const objLayer = map.layers[1];
    expect(objLayer.type).toBe('objectgroup');
    expect(objLayer.objects).toHaveLength(2);
    expect(objLayer.objects![0].name).toBe('task_board');
    expect(objLayer.objects![0].properties).toEqual({ roomId: 'meeting' });
    expect(objLayer.objects![1].name).toBe('archive_cabinet');
  });

  it('preserves layer visibility and opacity', () => {
    const map = parseTiledMap(sampleTiledJson);

    expect(map.layers[0].visible).toBe(true);
    expect(map.layers[0].opacity).toBe(1);
  });
});

describe('resolveTileSourceRect', () => {
  const floorsTileset: TiledTileset = {
    firstgid: 1,
    name: 'floors',
    tileWidth: 16,
    tileHeight: 16,
    columns: 8,
    image: 'floors.png',
    imageWidth: 128,
    imageHeight: 64,
  };

  const wallsTileset: TiledTileset = {
    firstgid: 33,
    name: 'walls',
    tileWidth: 16,
    tileHeight: 16,
    columns: 8,
    image: 'walls.png',
    imageWidth: 128,
    imageHeight: 128,
  };

  it('returns correct rect for first tile in first tileset (gid=1)', () => {
    const rect = resolveTileSourceRect(floorsTileset, 1);
    expect(rect).toBeInstanceOf(Rectangle);
    // localId = 0, col = 0, row = 0
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(16);
    expect(rect.height).toBe(16);
  });

  it('returns correct rect for gid=5 in first tileset', () => {
    const rect = resolveTileSourceRect(floorsTileset, 5);
    // localId = 4, col = 4 % 8 = 4, row = floor(4/8) = 0
    expect(rect.x).toBe(4 * 16);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(16);
    expect(rect.height).toBe(16);
  });

  it('returns correct rect for second row in first tileset (gid=9)', () => {
    const rect = resolveTileSourceRect(floorsTileset, 9);
    // localId = 8, col = 0, row = 1
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(1 * 16);
  });

  it('returns correct rect for tile in second tileset (gid=33)', () => {
    const rect = resolveTileSourceRect(wallsTileset, 33);
    // localId = 0, col = 0, row = 0
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
  });

  it('returns correct rect for tile in second tileset with offset (gid=40)', () => {
    const rect = resolveTileSourceRect(wallsTileset, 40);
    // localId = 7, col = 7, row = 0
    expect(rect.x).toBe(7 * 16);
    expect(rect.y).toBe(0);
  });

  it('returns correct rect for tile in second tileset wrapping to second row (gid=41)', () => {
    const rect = resolveTileSourceRect(wallsTileset, 41);
    // localId = 8, col = 0, row = 1
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(1 * 16);
  });
});

describe('findTilesetForGid', () => {
  const tilesets: TiledTileset[] = [
    {
      firstgid: 1,
      name: 'floors',
      tileWidth: 16,
      tileHeight: 16,
      columns: 8,
      image: 'floors.png',
      imageWidth: 128,
      imageHeight: 64,
    },
    {
      firstgid: 33,
      name: 'walls',
      tileWidth: 16,
      tileHeight: 16,
      columns: 8,
      image: 'walls.png',
      imageWidth: 128,
      imageHeight: 128,
    },
  ];

  it('finds first tileset for gid in range [1, 32]', () => {
    expect(findTilesetForGid(tilesets, 1)!.name).toBe('floors');
    expect(findTilesetForGid(tilesets, 15)!.name).toBe('floors');
    expect(findTilesetForGid(tilesets, 32)!.name).toBe('floors');
  });

  it('finds second tileset for gid >= 33', () => {
    expect(findTilesetForGid(tilesets, 33)!.name).toBe('walls');
    expect(findTilesetForGid(tilesets, 50)!.name).toBe('walls');
  });

  it('returns null for gid = 0 (empty tile)', () => {
    expect(findTilesetForGid(tilesets, 0)).toBeNull();
  });
});

describe('parseInteractables', () => {
  it('extracts interaction zones from objectgroup layer', () => {
    const layer: TiledLayer = {
      name: 'interactables',
      type: 'objectgroup',
      objects: [
        {
          id: 1,
          name: 'task_board',
          type: 'task',
          x: 48,
          y: 80,
          width: 32,
          height: 32,
          properties: { roomId: 'meeting' },
        },
        {
          id: 2,
          name: 'archive_cabinet',
          type: 'archive',
          x: 200,
          y: 150,
          width: 32,
          height: 64,
          properties: { roomId: 'archive' },
        },
      ],
      visible: true,
      opacity: 1,
    };

    const zones = parseInteractables(layer);
    expect(zones).toHaveLength(2);

    expect(zones[0]).toEqual({
      name: 'task_board',
      type: 'task',
      x: 48,
      y: 80,
      width: 32,
      height: 32,
      roomId: 'meeting',
    });

    expect(zones[1]).toEqual({
      name: 'archive_cabinet',
      type: 'archive',
      x: 200,
      y: 150,
      width: 32,
      height: 64,
      roomId: 'archive',
    });
  });

  it('returns empty array for tilelayer', () => {
    const layer: TiledLayer = {
      name: 'ground',
      type: 'tilelayer',
      data: [1, 2, 3],
      visible: true,
      opacity: 1,
    };

    expect(parseInteractables(layer)).toEqual([]);
  });

  it('handles objectgroup with no objects gracefully', () => {
    const layer: TiledLayer = {
      name: 'empty_objects',
      type: 'objectgroup',
      visible: true,
      opacity: 1,
    };

    expect(parseInteractables(layer)).toEqual([]);
  });

  it('uses empty string for roomId when properties are missing', () => {
    const layer: TiledLayer = {
      name: 'interactables',
      type: 'objectgroup',
      objects: [
        {
          id: 3,
          name: 'unknown_zone',
          type: 'generic',
          x: 10,
          y: 20,
          width: 16,
          height: 16,
        },
      ],
      visible: true,
      opacity: 1,
    };

    const zones = parseInteractables(layer);
    expect(zones).toHaveLength(1);
    expect(zones[0].roomId).toBe('');
  });
});
