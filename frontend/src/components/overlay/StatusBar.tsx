import { useSessionStore } from '../../stores/sessionStore';
import { useUiStore } from '../../stores/uiStore';

export function StatusBar() {
  const session = useSessionStore((s) => s.activeSession);
  const openNewTask = useUiStore((s) => s.openNewTaskModal);
  const openArchive = useUiStore((s) => s.openRoomArchive);

  const phaseLabels = session?.phases.map((p) => `${p.name}: ${p.status}`).join(' → ') ?? '';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-sm border-t border-gray-700 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-xs">
          {session ? (
            <>
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${session.status === 'running' ? 'bg-green-500' : session.status === 'completed' ? 'bg-blue-500' : session.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'}`} />
              Session: {session.id.slice(0, 14)}... | {session.status}
            </>
          ) : (
            '空闲'
          )}
        </span>
        {phaseLabels && <span className="text-gray-500 text-xs">{phaseLabels}</span>}
      </div>
      <div className="flex gap-2">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-md"
          onClick={() => openNewTask('rd')}
        >
          + 新任务
        </button>
        <button
          className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-md"
          onClick={() => openArchive('rd')}
        >
          档案柜
        </button>
      </div>
    </div>
  );
}
