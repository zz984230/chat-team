/**
 * generate-map.ts
 *
 * Generates floor and wall layer data for the Tiled office map JSON.
 * The layout matches mapConfig.ts exactly: 24x18 grid with 3 rooms
 * connected by a T-shaped corridor.
 *
 * Usage: npx tsx scripts/generate-map.ts
 *   (or: node scripts/generate-map.mjs after compiling)
 *
 * Outputs JSON arrays suitable for pasting into a Tiled map file.
 */

const MAP_W = 24;
const MAP_H = 18;

// GIDs in the Room_Builder_32x32 tileset (firstgid = 1)
const WALL = 1;
const FLOOR = 2;
const EMPTY = 0;

// ── Room definitions (from mapConfig.ts) ──────────────────────────────────
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const rooms: Rect[] = [
  { x: 7, y: 0, width: 10, height: 9 },   // rd (top center)
  { x: 0, y: 12, width: 9, height: 6 },    // marketing (bottom left)
  { x: 15, y: 12, width: 9, height: 6 },   // finance (bottom right)
];

// T-shaped corridor
const hCorridor: Rect = { x: 0, y: 10, width: 24, height: 2 };  // horizontal
const vCorridor: Rect = { x: 10, y: 9, width: 4, height: 3 };   // vertical stem

// ── Helpers ───────────────────────────────────────────────────────────────

function createGrid(fill: number): number[][] {
  return Array.from({ length: MAP_H }, () => Array(MAP_W).fill(fill));
}

function fillRect(grid: number[][], rect: Rect, value: number): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) {
        grid[y][x] = value;
      }
    }
  }
}

/**
 * Draw a 1-tile-wide wall border around a filled rectangle region.
 * Only places wall tiles on cells that are currently EMPTY.
 */
function wallBorder(grid: number[][], rect: Rect): void {
  const top = rect.y;
  const bottom = rect.y + rect.height - 1;
  const left = rect.x;
  const right = rect.x + rect.width - 1;

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) {
        // Only place wall on the perimeter
        const isPerimeter =
          y === top || y === bottom || x === left || x === right;
        if (isPerimeter && grid[y][x] === EMPTY) {
          grid[y][x] = WALL;
        }
      }
    }
  }
}

/**
 * For a region that is already filled with FLOOR, draw walls on its perimeter
 * that overlap with EMPTY cells outside the region.
 */
function wallBorderFromFloor(
  wallGrid: number[][],
  floorGrid: number[][],
  rect: Rect,
): void {
  const top = rect.y;
  const bottom = rect.y + rect.height - 1;
  const left = rect.x;
  const right = rect.x + rect.width - 1;

  for (let y = top - 1; y <= bottom + 1; y++) {
    for (let x = left - 1; x <= right + 1; x++) {
      if (y < 0 || y >= MAP_H || x < 0 || x >= MAP_W) continue;
      const isPerimeter =
        y === top || y === bottom || x === left || x === right;
      // If this cell is on the perimeter of the rect but NOT floor inside the rect,
      // it should be a wall
      if (isPerimeter && floorGrid[y]?.[x] !== FLOOR && wallGrid[y][x] === EMPTY) {
        wallGrid[y][x] = WALL;
      }
    }
  }
}

// ── Generate Floor layer ──────────────────────────────────────────────────

const floorGrid = createGrid(EMPTY);

// Fill rooms
for (const room of rooms) {
  fillRect(floorGrid, room, FLOOR);
}

// Fill corridor
fillRect(floorGrid, hCorridor, FLOOR);
fillRect(floorGrid, vCorridor, FLOOR);

// ── Generate Walls layer ──────────────────────────────────────────────────

const wallGrid = createGrid(EMPTY);

// Draw wall borders around each room (perimeter tiles that are NOT floor)
function drawRoomWalls(room: Rect): void {
  const top = room.y;
  const bottom = room.y + room.height - 1;
  const left = room.x;
  const right = room.x + room.width - 1;

  // Top wall
  if (top > 0) {
    for (let x = left; x <= right; x++) {
      if (floorGrid[top - 1][x] === EMPTY) {
        wallGrid[top - 1][x] = WALL;
      }
    }
  }
  // Bottom wall
  if (bottom < MAP_H - 1) {
    for (let x = left; x <= right; x++) {
      if (floorGrid[bottom + 1][x] === EMPTY) {
        wallGrid[bottom + 1][x] = WALL;
      }
    }
  }
  // Left wall
  if (left > 0) {
    for (let y = top; y <= bottom; y++) {
      if (floorGrid[y][left - 1] === EMPTY) {
        wallGrid[y][left - 1] = WALL;
      }
    }
  }
  // Right wall
  if (right < MAP_W - 1) {
    for (let y = top; y <= bottom; y++) {
      if (floorGrid[y][right + 1] === EMPTY) {
        wallGrid[y][right + 1] = WALL;
      }
    }
  }

  // Corner walls
  const corners = [
    { y: top - 1, x: left - 1 },
    { y: top - 1, x: right + 1 },
    { y: bottom + 1, x: left - 1 },
    { y: bottom + 1, x: right + 1 },
  ];
  for (const c of corners) {
    if (c.y >= 0 && c.y < MAP_H && c.x >= 0 && c.x < MAP_W) {
      if (floorGrid[c.y][c.x] === EMPTY) {
        wallGrid[c.y][c.x] = WALL;
      }
    }
  }
}

for (const room of rooms) {
  drawRoomWalls(room);
}

// Also draw outer border walls for the top edge (rd room touches y=0)
// For the top row, we need walls above the map (can't place) so skip
// Left and right edges of the map for full height
for (let y = 0; y < MAP_H; y++) {
  // Left edge wall
  if (floorGrid[y][0] === EMPTY) {
    wallGrid[y][0] = WALL;
  }
  // Right edge wall (x=23)
  if (floorGrid[y][MAP_W - 1] === EMPTY) {
    wallGrid[y][MAP_W - 1] = WALL;
  }
}
// Top edge
for (let x = 0; x < MAP_W; x++) {
  if (floorGrid[0][x] === EMPTY) {
    wallGrid[0][x] = WALL;
  }
}
// Bottom edge
for (let x = 0; x < MAP_W; x++) {
  if (floorGrid[MAP_H - 1][x] === EMPTY) {
    wallGrid[MAP_H - 1][x] = WALL;
  }
}

// Fill any remaining empty cells that are completely surrounded by walls/floor
// (i.e., fill small gaps that should be walls for visual consistency)
for (let y = 0; y < MAP_H; y++) {
  for (let x = 0; x < MAP_W; x++) {
    if (floorGrid[y][x] === EMPTY && wallGrid[y][x] === EMPTY) {
      wallGrid[y][x] = WALL;
    }
  }
}

// ── Flatten arrays ────────────────────────────────────────────────────────

const floorData = floorGrid.flat();
const wallData = wallGrid.flat();

// ── Output ────────────────────────────────────────────────────────────────

function formatArray(arr: number[], perLine = 24): string {
  const lines: string[] = [];
  for (let i = 0; i < arr.length; i += perLine) {
    lines.push('    ' + arr.slice(i, i + perLine).join(','));
  }
  return lines.join(',\n');
}

console.log('// ── Floor layer data ─────────────────────────────');
console.log(`// Length: ${floorData.length}`);
console.log(`[\n${formatArray(floorData)}\n  ]`);

console.log('\n// ── Walls layer data ─────────────────────────────');
console.log(`// Length: ${wallData.length}`);
console.log(`[\n${formatArray(wallData)}\n  ]`);

// ── Visual preview ────────────────────────────────────────────────────────

console.log('\n// ── Visual preview (combined) ────────────────────');
for (let y = 0; y < MAP_H; y++) {
  let row = '// ';
  for (let x = 0; x < MAP_W; x++) {
    if (wallGrid[y][x] === WALL) row += '#';
    else if (floorGrid[y][x] === FLOOR) row += '.';
    else row += ' ';
  }
  console.log(row);
}

// ── Summary ───────────────────────────────────────────────────────────────
const floorCount = floorData.filter((v) => v === FLOOR).length;
const wallCount = wallData.filter((v) => v === WALL).length;
const emptyCount = floorData.filter((v) => v === EMPTY).length + wallData.filter((v) => v === EMPTY).length;
console.log(`\n// Summary: ${floorCount} floor, ${wallCount} wall, ${emptyCount} empty (should be 0 combined)`);
console.log(`// Total tiles: ${MAP_W * MAP_H}`);
