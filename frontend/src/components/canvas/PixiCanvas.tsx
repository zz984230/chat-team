import { useRef, useEffect, useState, type ReactNode } from 'react';
import { Stage, Container } from '@pixi/react';
import { Container as PixiContainer } from '@pixi/display';
import { Viewport } from 'pixi-viewport';
import { MAP_CONFIG } from '../../data/mapConfig';

interface PixiCanvasProps {
  children?: ReactNode;
}

export function PixiCanvas({ children }: PixiCanvasProps) {
  const viewportRef = useRef<Viewport | null>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
      if (viewportRef.current) {
        viewportRef.current.screenWidth = window.innerWidth;
        viewportRef.current.screenHeight = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const worldWidth = MAP_CONFIG.mapWidth * MAP_CONFIG.tileWidth;
  const worldHeight = MAP_CONFIG.mapHeight * MAP_CONFIG.tileHeight;

  return (
    <Stage
      width={dimensions.width}
      height={dimensions.height}
      options={{
        backgroundColor: 0x1a1a2e,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      }}
    >
      <ViewportWrapper
        screenWidth={dimensions.width}
        screenHeight={dimensions.height}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        onViewportReady={(vp) => {
          viewportRef.current = vp;
        }}
      >
        {children}
      </ViewportWrapper>
    </Stage>
  );
}

function ViewportWrapper({
  screenWidth,
  screenHeight,
  worldWidth,
  worldHeight,
  onViewportReady,
  children,
}: {
  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  onViewportReady: (vp: Viewport) => void;
  children?: ReactNode;
}) {
  const containerRef = useRef<PixiContainer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Walk up the tree to find the Application's renderer
    // The parent chain from Container in @pixi/react is:
    //   our Container -> Stage's internal Container -> Stage
    // We need the renderer from the Application to create the EventSystem
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stageContainer = (container as any)?.parent;
    if (!stageContainer) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = stageContainer._application as { renderer: { events: any } } | undefined;
    if (!app?.renderer?.events) return;

    // pixi-viewport v5 ships stale v6-era types (interaction?: InteractionManager)
    // but the runtime code expects events: EventSystem for PixiJS v7.
    // Cast to any to bridge the mismatch.
    const vp = new Viewport({
      events: app.renderer.events,
      screenWidth,
      screenHeight,
      worldWidth,
      worldHeight,
      passiveWheel: false,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    vp.drag()
      .pinch()
      .wheel()
      .decelerate()
      .clamp({ direction: 'all', underflow: 'center' })
      .setZoom(1);

    container.addChild(vp);
    onViewportReady(vp);

    return () => {
      vp.destroy();
    };
  }, [screenWidth, screenHeight, worldWidth, worldHeight, onViewportReady]);

  // NOTE: children cannot be rendered as regular @pixi/react children here
  // because the viewport is created imperatively. The viewport itself is the
  // container for children. Children rendering will be handled differently
  // in the integration task.
  void children;

  return <Container ref={containerRef} />;
}
