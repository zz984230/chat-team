import Phaser from 'phaser';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, AGENT_SEATS, type AgentVisual, type GameCallbacks } from './types';
import { defineAnimations, createAgentVisual, playAnimation, updateBubble, moveAgentTo } from './AgentSpriteFactory';
import type { AgentAnimationState, AgentDirection } from '../types';

const SCENE_KEY = 'OfficeScene';

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
    // Tilesets — names must match the tileset "name" in library.json
    this.load.image('CuteRPG_Field_B', 'assets/tilesets/CuteRPG_Field_B.png');
    this.load.image('CuteRPG_Field_C', 'assets/tilesets/CuteRPG_Field_C.png');
    this.load.image('Room_Builder_32x32', 'assets/tilesets/Room_Builder_32x32.png');
    this.load.image('interiors_pt1', 'assets/tilesets/interiors_pt1.png');
    this.load.image('interiors_pt2', 'assets/tilesets/interiors_pt2.png');

    this.load.tilemapTiledJSON('library', 'assets/maps/library.json');

    // Character atlas (misa from Phaser tutorial)
    this.load.atlas('atlas', 'assets/sprites/atlas.png', 'assets/sprites/atlas.json');
  }

  create() {
    const map = this.make.tilemap({ key: 'library' });

    // Register tileset images with the tilemap
    const cuteB = map.addTilesetImage('CuteRPG_Field_B');
    const cuteC = map.addTilesetImage('CuteRPG_Field_C');
    const room = map.addTilesetImage('Room_Builder_32x32');
    const int1 = map.addTilesetImage('interiors_pt1');
    const int2 = map.addTilesetImage('interiors_pt2');

    const tilesets = [cuteB!, cuteC!, room!, int1!, int2!];

    // Layer depths
    const depthMap: Record<string, number> = {
      'Bottom Ground': 0,
      'Interior Ground': 0,
      'Wall': 1,
      'Interior Furniture L1': 2,
      'Interior Furniture L2 ': 2,
      'Foreground L1': 10,
      'Foreground L2': 10,
    };

    for (const layerName of Object.keys(depthMap)) {
      if (!map.getLayer(layerName)) continue;
      const layer = map.createLayer(layerName, tilesets, 0, 0);
      if (layer) layer.setDepth(depthMap[layerName]);
    }

    // Agent animations and sprites
    defineAnimations(this);

    for (const agentId of Object.keys(AGENT_SEATS)) {
      const visual = createAgentVisual(this, agentId, (id) => {
        this.callbacks?.onAgentClick(id);
      });
      this.agents.set(agentId, visual);
    }

    // Camera — center and zoom to fit
    const cx = (MAP_WIDTH * TILE_SIZE) / 2;
    const cy = (MAP_HEIGHT * TILE_SIZE) / 2;
    this.cameras.main.centerOn(cx, cy);
    const zx = (this.scale.width - 40) / (MAP_WIDTH * TILE_SIZE);
    const zy = (this.scale.height - 40) / (MAP_HEIGHT * TILE_SIZE);
    this.cameras.main.setZoom(Math.min(zx, zy));

    this.scale.on('resize', () => {
      const zx2 = (this.scale.width - 40) / (MAP_WIDTH * TILE_SIZE);
      const zy2 = (this.scale.height - 40) / (MAP_HEIGHT * TILE_SIZE);
      this.cameras.main.setZoom(Math.min(zx2, zy2));
      this.cameras.main.centerOn(cx, cy);
    });
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
