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
    this.load.image('CuteRPG_Field_B', 'assets/tilesets/CuteRPG_Field_B.png');
    this.load.image('CuteRPG_Field_C', 'assets/tilesets/CuteRPG_Field_C.png');
    this.load.image('Room_Builder_32x32', 'assets/tilesets/Room_Builder_32x32.png');
    this.load.image('interiors_pt1', 'assets/tilesets/interiors_pt1.png');
    this.load.image('interiors_pt2', 'assets/tilesets/interiors_pt2.png');

    this.load.tilemapTiledJSON('library', 'assets/maps/library.json');
    this.load.atlas('atlas', 'assets/sprites/atlas.png', 'assets/sprites/atlas.json');
  }

  create() {
    const map = this.make.tilemap({ key: 'library' });

    // addTilesetImage(tilesetName, imageKey) — tilesetName must match library.json
    const tilesets = [
      map.addTilesetImage('CuteRPG_Field_B', 'CuteRPG_Field_B'),
      map.addTilesetImage('CuteRPG_Field_C', 'CuteRPG_Field_C'),
      map.addTilesetImage('Room_Builder_32x32', 'Room_Builder_32x32'),
      map.addTilesetImage('interiors_pt1', 'interiors_pt1'),
      map.addTilesetImage('interiors_pt2', 'interiors_pt2'),
    ].filter(Boolean) as Phaser.Tilemaps.Tileset[];

    const layerOrder = [
      'Bottom Ground', 'Interior Ground', 'Wall',
      'Interior Furniture L1', 'Interior Furniture L2 ',
      'Foreground L1', 'Foreground L2',
    ];
    const depthMap: Record<string, number> = {
      'Bottom Ground': 0,
      'Interior Ground': 0,
      'Wall': 1,
      'Interior Furniture L1': 2,
      'Interior Furniture L2 ': 2,
      'Foreground L1': 10,
      'Foreground L2': 10,
    };

    for (const layerName of layerOrder) {
      if (!map.getLayer(layerName)) continue;
      const layer = map.createLayer(layerName, tilesets, 0, 0);
      if (layer) {
        layer.setDepth(depthMap[layerName] ?? 0);
      }
    }

    defineAnimations(this);

    for (const agentId of Object.keys(AGENT_SEATS)) {
      const visual = createAgentVisual(this, agentId, (id) => {
        this.callbacks?.onAgentClick(id);
      });
      this.agents.set(agentId, visual);
    }

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

  update(_time: number, _delta: number) {
    // Agent state updates driven by React via setAgent* methods
  }

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
