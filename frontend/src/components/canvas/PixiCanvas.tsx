import { useEffect, useState, type ReactNode } from 'react';
import { Stage, Container } from '@pixi/react';

interface PixiCanvasProps {
  children?: ReactNode;
}

export function PixiCanvas({ children }: PixiCanvasProps) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      <Container>{children}</Container>
    </Stage>
  );
}
