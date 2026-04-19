# Phaser 3 Office Map Design

Date: 2026-04-19

## Summary

Replace PixiJS canvas rendering with Phaser 3, using the Oak Hill College Library room extracted from the generative_agents (Stanford Smallville) project as the R&D office map. Keep existing React Overlay components unchanged.

## Motivation

The current PixiJS-based office map rendering looks chaotic. The generative_agents project has a polished tile-based rendering system using Phaser 3 with the same tilesets (Room_Builder + interiors). By extracting a single room from that project and switching to Phaser 3, we get better rendering capabilities (built-in tilemap support, physics engine, camera system) with a proven visual style.

## Architecture

### Overall Structure

```
React App
├── PhaserGame Component (NEW - replaces PixiCanvas)
│   └── Phaser 3 Game Instance
│       └── OfficeScene (single scene)
│           ├── Tilemap (library room)
│           ├── Agent Sprites (4 agents with atlas.png)
│           ├── Camera (auto-fit to viewport)
│           └── Effects (celebration, flying documents)
└── React Overlay (UNCHANGED)
    ├── StatusBar
    ├── AgentDetailPanel
    ├── NewTaskModal
    ├── DocViewer
    ├── ArchiveDrawer
    └── Modal
```

### React ↔ Phaser Communication

**Direction: React → Phaser** (via ref calls)
- `scene.setAgentPosition(id, x, y)` — move agent sprite
- `scene.setAgentState(id, state)` — switch animation (idle/walking/working/thinking)
- `scene.setAgentThinking(id, content)` — show/update thought bubble
- `scene.setToolUsage(id, tools)` — show tool usage indicator

**Direction: Phaser → React** (via callback props)
- `onAgentClick(id)` — agent clicked
- `onRoomClick(zone)` — interaction zone clicked

State flows one-way from Zustand stores into Phaser via the PhaserGame component ref. Phaser events propagate back through callback props.

### Phaser Scene Design

Single `OfficeScene` with three lifecycle methods:

- **preload()**: Load library.json tilemap, tileset images (Room_Builder, interiors_pt1-5), atlas.png + atlas.json sprite definitions
- **create()**: Create tilemap layers (Floor, Walls, Furniture, Foreground), place agent sprites at initial positions, set up arcade physics, configure camera
- **update(time, delta)**: Update agent animations, thought bubbles, visual effects

### Map: Oak Hill College Library

Extracted from generative_agents map (140×100 tiles) at coordinates (118,19) to (124,29).

**Properties:**
- Size: 7×11 tiles (224×352 pixels)
- Tile size: 32×32 pixels
- 4 agents at 32×32 pixels — fits comfortably (~51 walkable tiles, 8% agent coverage)
- Phaser camera auto-zooms to fill viewport

**Tile layers (from extraction):**
- Bottom Ground: outdoor grass border
- Interior Ground: tile ID 490 (indoor floor)
- Wall: top wall with corners, bottom wall with door opening
- Interior Furniture L1: bookshelves (top/right), library tables (center), computer desk
- Foreground: wall tops for depth effect

**Furniture layout:**
- Top-left: bookshelf area (IDs 16579, 16580, 16595, 16596)
- Top-right: computer desk area (IDs 15508-15527)
- Center: 3×2 library tables (IDs 14881, 14897, 14915, 14931 + table surfaces 19128-19176)
- Right wall: bookshelves column (IDs 15423-15471)

### Agent Sprites

Use generative_agents atlas.png ("misa" character from Phaser tutorial). The atlas is loaded from an external URL in generative_agents; we will localize a copy.

- 32×32 pixel frames
- 4 directional walk animations (4 frames each): `misa-front-walk`, `misa-back-walk`, `misa-left-walk`, `misa-right-walk`
- Static poses: `misa-front`, `misa-back`, `misa-left`, `misa-right`
- Note: The local `atlas.json` at `static_dirs/assets/characters/` uses different frame names (`down-walk` etc.). We will use the original external atlas naming convention (`misa-*`) for consistency with the generative_agents code.
- 4 agents distinguished by Phaser tint colors (same sprite, different color overlay)

**Agent-to-furniture assignment:**
- analyst → top-right computer desk area
- architect → center table left
- dev-lead → center table right
- test-lead → bottom open area

### Visual Effects

- **CelebrationEffect**: Port from PixiJS to Phaser particles/tweens
- **FlyingDocument**: Port from PixiJS to Phaser tween animation
- **Thought bubbles**: Phaser Text/Container objects positioned above agent sprites

## File Changes

### Delete
```
frontend/src/components/canvas/PixiCanvas.tsx
frontend/src/components/canvas/TiledMap.tsx
frontend/src/components/canvas/AgentSprite.tsx
frontend/src/components/canvas/AllAgentSprites.tsx
frontend/src/components/canvas/CelebrationEffect.tsx
frontend/src/components/canvas/FlyingDocument.tsx
frontend/src/utils/tmxLoader.ts
frontend/src/data/mapConfig.ts
frontend/src/data/agentConfig.ts
frontend/src/data/spritesheets/
frontend/public/assets/maps/the_office.json
```

### Create
```
frontend/src/components/canvas/PhaserGame.tsx       — React wrapper for Phaser
frontend/src/game/OfficeScene.ts                     — Phaser Scene (map + agents + effects)
frontend/src/game/AgentSpriteFactory.ts              — Agent sprite creation and animation definitions
frontend/src/game/MapLoader.ts                       — Library map extraction/loading
frontend/public/assets/maps/library.json             — Extracted library room (Tiled JSON)
frontend/public/assets/sprites/atlas.png             — Character sprite sheet (localized copy)
frontend/public/assets/sprites/atlas.json            — Frame definitions
```

### Modify
```
frontend/src/App.tsx                                 — PixiCanvas → PhaserGame
frontend/src/stores/agentStore.ts                    — Remove PixiJS-specific logic
frontend/package.json                                — Swap deps: pixi → phaser
```

### Unchanged
```
frontend/src/components/overlay/*                    — All overlay components
frontend/src/stores/sessionStore.ts                  — Session management
frontend/src/stores/uiStore.ts                       — UI state
frontend/src/hooks/useWebSocket.ts                   — WebSocket
frontend/src/services/api.ts                         — API client
frontend/src/components/ui/*                         — Modal etc.
```

## Dependencies

### Remove
- `pixi.js`
- `@pixi/react`
- `pixi-viewport`
- `@pixi/tilemap` (if present)

### Add
- `phaser` (^3.80.0)

### Keep
- `react`, `react-dom`
- `zustand`
- `tailwindcss`
- All other existing dependencies

## Error Handling

- **Asset load failure**: Phaser Scene's `load.on('loaderror')` captures errors, displays error overlay
- **Phaser init failure**: PhaserGame component try-catch with fallback error message
- **WebSocket disconnect**: Existing reconnection logic unchanged

## Testing

- Reuse Vitest + Testing Library framework
- Phaser Scene logic tested via mocked Phaser API
- Integration tests verify React ↔ Phaser communication
- Existing overlay component tests unchanged
