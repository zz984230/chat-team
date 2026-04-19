import Phaser from 'phaser';
import { TILE_SIZE, AGENT_SEATS, type AgentVisual, type GameCallbacks } from './types';
import { defineAnimations, createAgentVisual, playAnimation, updateBubble, moveAgentTo } from './AgentSpriteFactory';
import type { AgentAnimationState, AgentDirection } from '../types';
import { RandomWalker } from './RandomWalker';

const SCENE_KEY = 'OfficeScene';

// Library room position in the full 140x100 map
const LIB_X = 118;
const LIB_Y = 19;

export class OfficeScene extends Phaser.Scene {
  private agents: Map<string, AgentVisual> = new Map();
  private callbacks!: GameCallbacks;
  private walkers: Map<string, RandomWalker> = new Map();

  constructor() {
    super({ key: SCENE_KEY });
  }

  setCallbacks(cb: GameCallbacks) {
    this.callbacks = cb;
  }

  preload() {
    // Load all tileset images (matching paths in the_ville.json)
    this.load.image('CuteRPG_Field_B', 'assets/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_B.png');
    this.load.image('CuteRPG_Field_C', 'assets/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_C.png');
    this.load.image('CuteRPG_Harbor_C', 'assets/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Harbor_C.png');
    this.load.image('Room_Builder_32x32', 'assets/map_assets/v1/Room_Builder_32x32.png');
    this.load.image('CuteRPG_Village_B', 'assets/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Village_B.png');
    this.load.image('CuteRPG_Forest_B', 'assets/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_B.png');
    this.load.image('CuteRPG_Desert_C', 'assets/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_C.png');
    this.load.image('CuteRPG_Mountains_B', 'assets/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Mountains_B.png');
    this.load.image('CuteRPG_Desert_B', 'assets/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_B.png');
    this.load.image('CuteRPG_Forest_C', 'assets/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_C.png');
    this.load.image('interiors_pt1', 'assets/map_assets/v1/interiors_pt1.png');
    this.load.image('interiors_pt2', 'assets/map_assets/v1/interiors_pt2.png');
    this.load.image('interiors_pt3', 'assets/map_assets/v1/interiors_pt3.png');
    this.load.image('interiors_pt4', 'assets/map_assets/v1/interiors_pt4.png');
    this.load.image('interiors_pt5', 'assets/map_assets/v1/interiors_pt5.png');
    this.load.image('blocks', 'assets/map_assets/blocks/blocks_1.png');
    this.load.image('blocks_2', 'assets/map_assets/blocks/blocks_2.png');
    this.load.image('blocks_3', 'assets/map_assets/blocks/blocks_3.png');

    // Full generative_agents map (same JSON they use)
    this.load.tilemapTiledJSON('the_ville', 'assets/maps/the_ville.json');

    // Agent character spritesheet
    this.load.atlas('agents', 'assets/sprites/atlas.png', 'assets/sprites/atlas.json');
  }

  create() {
    const map = this.make.tilemap({ key: 'the_ville' });

    const cuteB = map.addTilesetImage('CuteRPG_Field_B');
    const cuteC = map.addTilesetImage('CuteRPG_Field_C');
    const cuteH = map.addTilesetImage('CuteRPG_Harbor_C');
    const room = map.addTilesetImage('Room_Builder_32x32');
    const cuteV = map.addTilesetImage('CuteRPG_Village_B');
    const cuteFB = map.addTilesetImage('CuteRPG_Forest_B');
    const cuteDC = map.addTilesetImage('CuteRPG_Desert_C');
    const cuteMB = map.addTilesetImage('CuteRPG_Mountains_B');
    const cuteDB = map.addTilesetImage('CuteRPG_Desert_B');
    const cuteFC = map.addTilesetImage('CuteRPG_Forest_C');
    const int1 = map.addTilesetImage('interiors_pt1');
    const int2 = map.addTilesetImage('interiors_pt2');
    const int3 = map.addTilesetImage('interiors_pt3');
    const int4 = map.addTilesetImage('interiors_pt4');
    const int5 = map.addTilesetImage('interiors_pt5');
    const blk = map.addTilesetImage('blocks');
    const blk2 = map.addTilesetImage('blocks_2');
    const blk3 = map.addTilesetImage('blocks_3');

    const tilesets = [cuteB!, cuteC!, cuteH!, room!, cuteV!, cuteFB!, cuteDC!, cuteMB!, cuteDB!, cuteFC!,
                      int1!, int2!, int3!, int4!, int5!, blk!, blk2!, blk3!];

    const layers = [
      { name: 'Bottom Ground', depth: 0 },
      { name: 'Exterior Ground', depth: 0 },
      { name: 'Exterior Decoration L1', depth: 0 },
      { name: 'Exterior Decoration L2', depth: 0 },
      { name: 'Interior Ground', depth: 0 },
      { name: 'Wall', depth: 1 },
      { name: 'Interior Furniture L1', depth: 2 },
      { name: 'Interior Furniture L2 ', depth: 2 },
      { name: 'Foreground L1', depth: 10 },
      { name: 'Foreground L2', depth: 10 },
    ];

    for (const { name, depth } of layers) {
      if (!map.getLayer(name)) continue;
      const layer = map.createLayer(name, tilesets, 0, 0);
      if (layer) layer.setDepth(depth);
    }

    const collisionLayer = map.getLayer('Collisions');
    if (collisionLayer) {
      const cl = map.createLayer('Collisions', tilesets, 0, 0);
      if (cl) cl.setDepth(-1).setAlpha(0);
    }

    defineAnimations(this);

    // Place agents at their seats within the library room (map pixel coords)
    for (const agentId of Object.keys(AGENT_SEATS)) {
      const visual = createAgentVisual(this, agentId, (id) => {
        this.callbacks?.onAgentClick(id);
      });
      const seat = AGENT_SEATS[agentId]!;
      const px = (LIB_X + seat.x) * TILE_SIZE + TILE_SIZE / 2;
      const py = (LIB_Y + seat.y) * TILE_SIZE + TILE_SIZE / 2;
      visual.body.setPosition(px, py);
      visual.body.setDepth(py);
      visual.bubbleContainer.setPosition(px, py - 48);
      this.agents.set(agentId, visual);
    }

    // Initialize walkers for idle wandering
    for (const [agentId, visual] of this.agents) {
      this.walkers.set(agentId, new RandomWalker(visual));
    }

    // Interactive furniture zones
    const tableZone = this.add.zone(
      (LIB_X + 2.5) * TILE_SIZE,
      (LIB_Y + 4) * TILE_SIZE,
      2 * TILE_SIZE,
      3 * TILE_SIZE,
    );
    tableZone.setInteractive({ useHandCursor: true });
    tableZone.setDepth((LIB_Y + 5) * TILE_SIZE);

    const cabinetZone = this.add.zone(
      (LIB_X + 5) * TILE_SIZE,
      (LIB_Y + 0.5) * TILE_SIZE,
      3 * TILE_SIZE,
      2 * TILE_SIZE,
    );
    cabinetZone.setInteractive({ useHandCursor: true });
    cabinetZone.setDepth((LIB_Y + 0) * TILE_SIZE);

    // Camera — full town view with drag & zoom
    const FULL_W = 140;
    const FULL_H = 100;
    const mapPixelW = FULL_W * TILE_SIZE;
    const mapPixelH = FULL_H * TILE_SIZE;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, mapPixelW, mapPixelH);

    const fitZoom = Math.min(this.scale.width / mapPixelW, this.scale.height / mapPixelH);
    cam.setZoom(fitZoom);
    cam.centerOn(mapPixelW / 2, mapPixelH / 2);

    const MIN_ZOOM = fitZoom;
    const MAX_ZOOM = 3;

    let dragStartX = 0;
    let dragStartY = 0;
    let camStartX = 0;
    let camStartY = 0;
    let dragging = false;
    let pointerMoved = false;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      dragging = true;
      pointerMoved = false;
      dragStartX = pointer.x;
      dragStartY = pointer.y;
      camStartX = cam.scrollX;
      camStartY = cam.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dx = pointer.x - dragStartX;
      const dy = pointer.y - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        pointerMoved = true;
      }
      if (pointerMoved) {
        cam.scrollX = camStartX - dx / cam.zoom;
        cam.scrollY = camStartY - dy / cam.zoom;
      }
    });

    this.input.on('pointerup', () => {
      dragging = false;
    });

    tableZone.on('pointerup', () => {
      if (!pointerMoved) {
        this.callbacks?.onRoomClick('task');
      }
    });

    cabinetZone.on('pointerup', () => {
      if (!pointerMoved) {
        this.callbacks?.onRoomClick('archive');
      }
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any[], _dx: number, dy: number) => {
      const zoomFactor = dy > 0 ? 0.9 : 1.1;
      const newZoom = Phaser.Math.Clamp(cam.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);

      // Phaser midPoint = scroll + halfViewport (independent of zoom).
      // World at pointer = midPoint + (pointer - halfViewport) / zoom.
      // Scroll delta keeps the same world point under the mouse after zoom.
      const halfW = cam.width / 2;
      const halfH = cam.height / 2;
      cam.scrollX += (_pointer.x - halfW) * (1 / cam.zoom - 1 / newZoom);
      cam.scrollY += (_pointer.y - halfH) * (1 / cam.zoom - 1 / newZoom);
      cam.setZoom(newZoom);
    });

    this.scale.on('resize', () => {
      const newFitZoom = Math.min(this.scale.width / mapPixelW, this.scale.height / mapPixelH);
      if (cam.zoom < newFitZoom) {
        cam.setZoom(newFitZoom);
        cam.centerOn(mapPixelW / 2, mapPixelH / 2);
      }
    });
  }

  update(_time: number, delta: number) {
    for (const walker of this.walkers.values()) {
      walker.update(delta);
    }
  }

  resetAllAgents() {
    for (const walker of this.walkers.values()) {
      walker.returnToSeat();
      walker.setAgentState('idle');
    }
  }

  setAgentState(agentId: string, state: AgentAnimationState) {
    const visual = this.agents.get(agentId);
    if (visual) playAnimation(visual, state, visual.direction);
    const walker = this.walkers.get(agentId);
    if (walker) walker.setAgentState(state);
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

  shutdown() {
    for (const walker of this.walkers.values()) {
      walker.destroy();
    }
    this.walkers.clear();
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.input.off('wheel');
    this.scale.off('resize');
  }
}
