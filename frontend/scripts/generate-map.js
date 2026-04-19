#!/usr/bin/env node

/**
 * generate-map.js
 *
 * Generates floor and wall layer data for the Tiled office map JSON.
 * The layout matches mapConfig.ts exactly: 24x18 grid with 3 rooms
 * connected by a T-shaped corridor.
 *
 * Usage: node scripts/generate-map.js
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

const rooms = [
  { x: 7, y: 0, width: 10, height: 9 },   // rd (top center)
  { x: 0, y: 12, width: 9, height: 6 },    // marketing (bottom left)
  { x: 15, y: 12, width: 9, height: 6 },   // finance (bottom right)
];

// T-shaped corridor
const hCorridor = { x: 0, y: 10, width: 24, height: 2 };  // horizontal
const vCorridor = { x: 10, y: 9, width: 4, height: 3 };   // vertical stem

// ── Helpers ───────────────────────────────────────────────────────────────

function createGrid(fill) {
  return Array.from({ length: MAP_H }, () => Array(MAP_W).fill(fill));
}

function fillRect(grid, rect, value) {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) {
        grid[y][x] = value;
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

// Draw wall borders around each room
function drawRoomWalls(room) {
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

// Draw corridor walls where corridor edges are adjacent to empty space
function drawCorridorWalls(corridor) {
  const top = corridor.y;
  const bottom = corridor.y + corridor.height - 1;
  const left = corridor.x;
  const right = corridor.x + corridor.width - 1;

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
}

drawCorridorWalls(hCorridor);
drawCorridorWalls(vCorridor);

// Fill any remaining empty cells with wall
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

console.log(JSON.stringify({ floorData, wallData }));

// ── Visual preview ────────────────────────────────────────────────────────

console.error('\nVisual preview (combined):');
for (let y = 0; y < MAP_H; y++) {
  let row = '';
  for (let x = 0; x < MAP_W; x++) {
    if (wallGrid[y][x] === WALL) row += '#';
    else if (floorGrid[y][x] === FLOOR) row += '.';
    else row += ' ';
  }
  console.error(row);
}

const floorCount = floorData.filter((v) => v === FLOOR).length;
const wallCount = wallData.filter((v) => v === WALL).length;
console.error(`\nSummary: ${floorCount} floor, ${wallCount} wall, total ${MAP_W * MAP_H}`);
