import { PixiCanvas } from './components/canvas/PixiCanvas';
import { OfficeMap } from './components/canvas/OfficeMap';
import { AllAgentSprites } from './components/canvas/AgentSprite';
import { NewTaskModal } from './components/overlay/NewTaskModal';
import { StatusBar } from './components/overlay/StatusBar';
import { AgentDetailPanel } from './components/overlay/AgentDetailPanel';
import { DocViewer } from './components/overlay/DocViewer';
import { ArchiveDrawer } from './components/overlay/ArchiveDrawer';
import { useWebSocket } from './hooks/useWebSocket';
import { useSessionStore } from './stores/sessionStore';

function GameScene() {
  return (
    <PixiCanvas>
      <OfficeMap />
      <AllAgentSprites />
    </PixiCanvas>
  );
}

export default function App() {
  const activeSessionId = useSessionStore((s) => s.activeSession?.id ?? null);
  useWebSocket(activeSessionId);

  return (
    <div className="w-full h-full relative">
      {/* Layer 1: PixiJS Canvas */}
      <GameScene />

      {/* Layer 2: HTML Overlays */}
      <NewTaskModal />
      <StatusBar />
      <AgentDetailPanel />
      <DocViewer />
      <ArchiveDrawer />
    </div>
  );
}
