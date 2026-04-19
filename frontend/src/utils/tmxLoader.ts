import { Rectangle } from '@pixi/math';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TiledTileset {
  firstgid: number;
  name: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  image: string;
  imageWidth: number;
  imageHeight: number;
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: Record<string, any>;
}

export interface TiledLayer {
  name: string;
  type: 'tilelayer' | 'objectgroup';
  data?: number[];
  objects?: TiledObject[];
  visible: boolean;
  opacity: number;
  properties?: Record<string, any>;
}

export interface TiledMapData {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tilesets: TiledTileset[];
  layers: TiledLayer[];
}

export interface InteractionZone {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  roomId: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Parse a raw Tiled JSON object into a typed TiledMapData structure.
 * Maps Tiled's lowercase field names (tilewidth, imagewidth, etc.) to camelCase.
 */
export function parseTiledMap(json: any): TiledMapData {
  const tilesets: TiledTileset[] = (json.tilesets ?? []).map(
    (ts: any): TiledTileset => ({
      firstgid: ts.firstgid,
      name: ts.name,
      tileWidth: ts.tilewidth,
      tileHeight: ts.tileheight,
      columns: ts.columns,
      image: ts.image,
      imageWidth: ts.imagewidth,
      imageHeight: ts.imageheight,
    }),
  );

  const layers: TiledLayer[] = (json.layers ?? []).map(
    (layer: any): TiledLayer => ({
      name: layer.name,
      type: layer.type,
      data: layer.data,
      objects: layer.objects?.map((obj: any): TiledObject => ({
        id: obj.id,
        name: obj.name,
        type: obj.type,
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        properties: obj.properties,
      })),
      visible: layer.visible ?? true,
      opacity: layer.opacity ?? 1,
      properties: layer.properties,
    }),
  );

  return {
    width: json.width,
    height: json.height,
    tileWidth: json.tilewidth,
    tileHeight: json.tileheight,
    tilesets,
    layers,
  };
}

/**
 * Fetch a Tiled JSON file from the given URL and parse it.
 */
export async function loadTiledMap(jsonPath: string): Promise<TiledMapData> {
  const response = await fetch(jsonPath);
  if (!response.ok) {
    throw new Error(`Failed to load tilemap: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  return parseTiledMap(json);
}

/**
 * Compute the source rectangle within a tileset image for the given global tile ID.
 */
export function resolveTileSourceRect(
  tileset: TiledTileset,
  gid: number,
): Rectangle {
  const localId = gid - tileset.firstgid;
  const col = localId % tileset.columns;
  const row = Math.floor(localId / tileset.columns);

  return new Rectangle(
    col * tileset.tileWidth,
    row * tileset.tileHeight,
    tileset.tileWidth,
    tileset.tileHeight,
  );
}

/**
 * Find which tileset a global tile ID belongs to.
 * Iterates from the end of the tileset array and returns the first tileset
 * where `gid >= firstgid`. Returns null for gid 0 (empty tile).
 */
export function findTilesetForGid(
  tilesets: TiledTileset[],
  gid: number,
): TiledTileset | null {
  if (gid === 0) return null;

  for (let i = tilesets.length - 1; i >= 0; i--) {
    if (gid >= tilesets[i].firstgid) {
      return tilesets[i];
    }
  }
  return null;
}

/**
 * Extract interaction zones from an objectgroup layer's objects.
 * Returns an empty array for non-objectgroup layers.
 */
export function parseInteractables(layer: TiledLayer): InteractionZone[] {
  if (layer.type !== 'objectgroup' || !layer.objects) {
    return [];
  }

  return layer.objects.map((obj) => ({
    name: obj.name,
    type: obj.type,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    roomId: (obj.properties?.roomId as string) ?? '',
  }));
}
