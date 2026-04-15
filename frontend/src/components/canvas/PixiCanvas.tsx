import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Stage } from '@pixi/react';
import { Viewport } from 'pixi-viewport';
import { Application } from 'pixi.js';
import { MAP_CONFIG } from '../../data/mapConfig';

export const ViewportContext = createContext<Viewport | null>(null);
export const useViewport = () => useContext(ViewportContext);

export function PixiCanvas({ children }: { children?: ReactNode }) {
  const [app, setApp] = useState<Application | null>(null);

  return (
    <>
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        options={{
          backgroundColor: 0x1a1a2e,
          antialias: false,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
        onMount={setApp}
      />
      {app && <ViewportLayer app={app}>{children}</ViewportLayer>}
    </>
  );
}

function ViewportLayer({ app, children }: { app: Application; children?: ReactNode }) {
  const [viewport, setViewport] = useState<Viewport | null>(null);

  useEffect(() => {
    // StrictMode 双重挂载时 renderer 可能已被 destroy，需守卫
    if (!app.renderer) return;

    const worldWidth = MAP_CONFIG.mapWidth * MAP_CONFIG.tileWidth;
    const worldHeight = MAP_CONFIG.mapHeight * MAP_CONFIG.tileHeight;

    const vp = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth,
      worldHeight,
      // pixi-viewport 5.x types expect InteractionManager, but PixiJS 7's EventSystem
      // is API-compatible for mapPositionToPoint which is all viewport uses it for
      interaction: app.renderer.events as never,
    });

    vp.drag()
      .wheel({ smooth: 5 })
      .decelerate({ friction: 0.9 })
      .clamp({ direction: 'all' })
      .clampZoom({
        minWidth: worldWidth / 2,
        minHeight: worldHeight / 2,
        maxWidth: worldWidth * 3,
        maxHeight: worldHeight * 3,
      });

    vp.fitWorld();
    vp.moveCenter(worldWidth / 2, worldHeight / 2);

    app.stage.addChild(vp);
    setViewport(vp);

    const onResize = () => {
      vp.resize(window.innerWidth, window.innerHeight, worldWidth, worldHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      vp.destroy({ children: true });
      if (!app.stage.destroyed) {
        app.stage.removeChild(vp);
      }
    };
  }, [app]);

  return (
    <ViewportContext.Provider value={viewport}>
      {viewport && children}
    </ViewportContext.Provider>
  );
}
