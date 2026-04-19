import { PhaserGame } from './components/canvas/PhaserGame';
import { CelebrationEffect } from './components/canvas/CelebrationEffect';
import { FlyingDocument } from './components/canvas/FlyingDocument';
import { NewTaskModal } from './components/overlay/NewTaskModal';
import { StatusBar } from './components/overlay/StatusBar';
import { AgentDetailPanel } from './components/overlay/AgentDetailPanel';
import { DocViewer } from './components/overlay/DocViewer';
import { ArchiveDrawer } from './components/overlay/ArchiveDrawer';
import { useSessionStore } from './stores/sessionStore';
import { useWebSocket } from './hooks/useWebSocket';

export default function App() {
  const activeSessionId = useSessionStore((s) => s.activeSession?.id ?? null);
  useWebSocket(activeSessionId);

  return (
    <div className="w-full h-full relative">
      <PhaserGame />
      <CelebrationEffect />
      <FlyingDocument />
      <NewTaskModal />
      <StatusBar />
      <AgentDetailPanel />
      <DocViewer />
      <ArchiveDrawer />
    </div>
  );
}
