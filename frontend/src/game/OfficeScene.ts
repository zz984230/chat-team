import Phaser from 'phaser';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, AGENT_SEATS, type AgentVisual, type GameCallbacks } from './types';
import { defineAnimations, createAgentVisual, playAnimation, updateBubble, moveAgentTo } from './AgentSpriteFactory';
import type { AgentAnimationState, AgentDirection } from '../types';

const SCENE_KEY = 'OfficeScene';

// Tile GIDs from library extraction (7x11 room)
// Tileset firstgids: CuteRPG_Field_B=1, CuteRPG_Field_C=257, Room_Builder=769, int1=10589, int2=15597

const TILES = {
  // CuteRPG_Field_B: GID 2 = grass (col 1, row 0 in CuteRPG_B 32x32 grid)
  grass: { sheet: 'CuteRPG_Field_B', col: 1, row: 0 },
  // CuteRPG_Field_C: GID 490 = 490-257=233 → col 233%16=9, row 233/16=14
  floor: { sheet: 'CuteRPG_Field_C', col: 9, row: 14 },
  // Room_Builder wall tiles
  wallH: { sheet: 'Room_Builder_32x32', col: 70, row: 5 },    // GID 5688 ≈ (5688-769)
  wallCornerL: { sheet: 'Room_Builder_32x32', col: 69, row: 5 }, // GID 5689
  wallCornerR: { sheet: 'Room_Builder_32x32', col: 71, row: 5 },
  wallBottom: { sheet: 'Room_Builder_32x32', col: 69, row: 6 },   // GID 5685
  doorFrame: { sheet: 'Room_Builder_32x32', col: 5, row: 7 },     // GID 5613
  doorTop: { sheet: 'Room_Builder_32x32', col: 5, row: 15 },      // GID 5761
};

export class OfficeScene extends Phaser.Scene {
  private agents: Map<string, AgentVisual> = new Map();
  private callbacks!: GameCallbacks;

  constructor() {
    super({ key: SCENE_KEY });
  }

  setCallbacks(cb: GameCallbacks) {
    this.callbacks = cb;
  }

  preload() {
    this.load.image('CuteRPG_Field_B', 'assets/tilesets/CuteRPG_Field_B.png');
    this.load.image('CuteRPG_Field_C', 'assets/tilesets/CuteRPG_Field_C.png');
    this.load.image('Room_Builder_32x32', 'assets/tilesets/Room_Builder_32x32.png');
    this.load.image('interiors_pt1', 'assets/tilesets/interiors_pt1.png');
    this.load.image('interiors_pt2', 'assets/tilesets/interiors_pt2.png');
    this.load.atlas('atlas', 'assets/sprites/atlas.png', 'assets/sprites/atlas.json');
  }

  create() {
    // Background - dark green grass border
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.add.sprite(x * TILE_SIZE + 16, y * TILE_SIZE + 16, 'CuteRPG_Field_B')
          .setCrop(1 * 32, 0 * 32, 32, 32)
          .setDepth(0);
      }
    }

    // Floor - indoor tiles (rows 1-8, cols 0-6; partial rows 9-10)
    for (let y = 1; y <= 8; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.add.sprite(x * TILE_SIZE + 16, y * TILE_SIZE + 16, 'CuteRPG_Field_C')
          .setCrop(9 * 32, 14 * 32, 32, 32)
          .setDepth(0);
      }
    }
    // Partial floor rows 9-10
    for (let y = 9; y <= 10; y++) {
      for (let x = 0; x < 3; x++) {
        this.add.sprite(x * TILE_SIZE + 16, y * TILE_SIZE + 16, 'CuteRPG_Field_C')
          .setCrop(9 * 32, 14 * 32, 32, 32)
          .setDepth(0);
      }
    }

    // Walls - top row
    this.placeTile(0, 0, 'Room_Builder_32x32', 69, 5, 1);  // corner left
    for (let x = 1; x < 6; x++) this.placeTile(x, 0, 'Room_Builder_32x32', 70, 5, 1);
    this.placeTile(6, 0, 'Room_Builder_32x32', 71, 5, 1);  // corner right

    // Walls - bottom (rows 9-10, door at col 2)
    this.placeTile(0, 9, 'Room_Builder_32x32', 69, 6, 1);
    this.placeTile(0, 10, 'Room_Builder_32x32', 5, 15, 1);
    for (let x = 3; x <= 6; x++) {
      this.placeTile(x, 9, 'Room_Builder_32x32', 5, 7, 1);
      this.placeTile(x, 10, 'Room_Builder_32x32', 5, 7, 1);
    }

    // Furniture from interiors tilesets
    // Bookshelves top-left area
    this.placeTile(0, 1, 'interiors_pt1', (16579 - 10589) % 16, Math.floor((16579 - 10589) / 16), 2);
    this.placeTile(1, 1, 'interiors_pt1', (16580 - 10589) % 16, Math.floor((16580 - 10589) / 16), 2);
    this.placeTile(0, 2, 'interiors_pt1', (16595 - 10589) % 16, Math.floor((16595 - 10589) / 16), 2);
    this.placeTile(1, 2, 'interiors_pt1', (16596 - 10589) % 16, Math.floor((16596 - 10589) / 16), 2);

    // Computer desk top-right
    for (let i = 0; i < 4; i++) {
      const gid = [15508, 15509, 15510, 15511][i];
      this.placeTile(3 + i, 0, 'interiors_pt1', (gid - 10589) % 16, Math.floor((gid - 10589) / 16), 2);
    }
    for (let i = 0; i < 4; i++) {
      const gid = [15524, 15525, 15526, 15527][i];
      this.placeTile(3 + i, 1, 'interiors_pt1', (gid - 10589) % 16, Math.floor((gid - 10589) / 16), 2);
    }

    // Library tables (center area)
    const tableGids = [14881, 19129, 19128, 14915, 14897, 19145, 19144, 14931];
    const tablePositions = [[1, 3], [2, 3], [3, 3], [4, 3], [1, 4], [2, 4], [3, 4], [4, 4]];
    for (let i = 0; i < tableGids.length; i++) {
      const gid = tableGids[i];
      const [tx, ty] = tablePositions[i];
      this.placeTile(tx, ty, 'interiors_pt1', (gid - 10589) % 16, Math.floor((gid - 10589) / 16), 2);
    }

    // More tables (rows 5-6)
    const tableGids2 = [14881, 19161, 19160, 14915, 14897, 19177, 19176, 14931];
    const tablePos2 = [[1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [2, 6], [3, 6], [4, 6]];
    for (let i = 0; i < tableGids2.length; i++) {
      this.placeTile(tablePos2[i][0], tablePos2[i][1], 'interiors_pt1',
        (tableGids2[i] - 10589) % 16, Math.floor((tableGids2[i] - 10589) / 16), 2);
    }

    // Bookshelves right wall (col 6, rows 5-8)
    for (let y = 5; y <= 8; y++) {
      const gid = [15423, 15439, 15455, 15471][y - 5];
      this.placeTile(6, y, 'interiors_pt1', (gid - 10589) % 16, Math.floor((gid - 10589) / 16), 2);
    }

    // Agents
    defineAnimations(this);
    for (const agentId of Object.keys(AGENT_SEATS)) {
      const visual = createAgentVisual(this, agentId, (id) => {
        this.callbacks?.onAgentClick(id);
      });
      this.agents.set(agentId, visual);
    }

    // Camera
    const cx = (MAP_WIDTH * TILE_SIZE) / 2;
    const cy = (MAP_HEIGHT * TILE_SIZE) / 2;
    this.cameras.main.centerOn(cx, cy);
    const zoomX = (this.scale.width - 40) / (MAP_WIDTH * TILE_SIZE);
    const zoomY = (this.scale.height - 40) / (MAP_HEIGHT * TILE_SIZE);
    this.cameras.main.setZoom(Math.min(zoomX, zoomY));

    this.scale.on('resize', () => {
      const zx = (this.scale.width - 40) / (MAP_WIDTH * TILE_SIZE);
      const zy = (this.scale.height - 40) / (MAP_HEIGHT * TILE_SIZE);
      this.cameras.main.setZoom(Math.min(zx, zy));
      this.cameras.main.centerOn(cx, cy);
    });
  }

  private placeTile(tileX: number, tileY: number, sheet: string, col: number, row: number, depth: number) {
    const sprite = this.add.sprite(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, sheet);
    sprite.setCrop(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    sprite.setDepth(depth);
    return sprite;
  }

  update(_time: number, _delta: number) {}

  setAgentState(agentId: string, state: AgentAnimationState) {
    const visual = this.agents.get(agentId);
    if (visual) playAnimation(visual, state, visual.direction);
  }

  setAgentDirection(agentId: string, direction: AgentDirection) {
    const visual = this.agents.get(agentId);
    if (visual) playAnimation(visual, visual.animState, direction);
  }

  setAgentThinking(agentId: string, content: string | null) {
    const visual = this.agents.get(agentId);
    if (visual) updateBubble(visual, content);
  }

  setAgentPosition(agentId: string, tileX: number, tileY: number) {
    const visual = this.agents.get(agentId);
    if (visual) moveAgentTo(visual, tileX, tileY, this);
  }
}
