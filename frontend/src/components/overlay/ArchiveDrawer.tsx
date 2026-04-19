import { useState } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSessionList } from '../../hooks/useSession';
import { ROOM_INFO } from '../../data/mapConfig';
import { Modal } from '../ui/Modal';

export function ArchiveDrawer() {
  const roomId = useUiStore((s) => s.roomArchiveOpen);
  const close = useUiStore((s) => s.closeRoomArchive);
  const openDoc = useUiStore((s) => s.openDocViewer);
  const { sessions } = useSessionList();
  const setActive = useSessionStore((s) => s.setActiveSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmTarget = confirmId ? sessions.find((s) => s.id === confirmId) : null;

  const roomAgents = roomId ? ROOM_INFO[roomId]?.agents ?? [] : [];
  const roomName = roomId ? ROOM_INFO[roomId]?.name ?? '' : '';

  const filteredSessions = sessions.filter((session) =>
    session.phases.some((p) => p.agents.some((a) => roomAgents.includes(a)))
  );

  const handleDelete = async () => {
    if (!confirmId) return;
    setDeleting(true);
    try {
      await deleteSession(confirmId);
      setConfirmId(null);
    } catch {
      // Error shown via UI state
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (status: string) =>
    status === 'completed' || status === 'failed' || status === 'cancelled';

  const uniqueOutputs = (outputs: string[]) => [...new Set(outputs)];

  if (!roomId) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={close} />
        <div className="relative w-96 bg-gray-800 border-l border-gray-700 h-full overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-semibold">档案柜 — {roomName}</h3>
              <button className="text-gray-400 hover:text-white" onClick={close}>✕</button>
            </div>

            {filteredSessions.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无文档</p>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-gray-900 rounded-lg p-3 border border-gray-700 cursor-pointer hover:border-gray-500"
                    onClick={() => setActive(session)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm font-mono">{session.id}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          session.status === 'completed' ? 'bg-green-900 text-green-400' :
                          session.status === 'running' ? 'bg-blue-900 text-blue-400' :
                          session.status === 'failed' ? 'bg-red-900 text-red-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {session.status}
                        </span>
                        {canDelete(session.status) && (
                          <button
                            className="text-gray-500 hover:text-red-400 text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmId(session.id);
                            }}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      {(session.input_requirement ?? '').length > 60
                        ? `${session.input_requirement.slice(0, 60)}...`
                        : (session.input_requirement ?? '')}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {uniqueOutputs(session.phases.flatMap((p) => p.outputs)).map((f) => (
                        <button
                          key={f}
                          className="text-xs text-blue-400 hover:text-blue-300 bg-gray-800 px-2 py-0.5 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDoc({ sessionId: session.id, filename: f });
                          }}
                        >
                          📄 {f}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={confirmId !== null}
        onClose={() => !deleting && setConfirmId(null)}
        title="删除档案"
      >
        <p className="text-gray-300 text-sm mb-4">
          确定要删除档案「{confirmTarget
            ? (confirmTarget.input_requirement.length > 30
              ? `${confirmTarget.input_requirement.slice(0, 30)}...`
              : confirmTarget.input_requirement)
            : ''}」吗？此操作不可恢复。
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-700 rounded-lg"
            onClick={() => setConfirmId(null)}
            disabled={deleting}
          >
            取消
          </button>
          <button
            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg disabled:opacity-50"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? '删除中...' : '删除'}
          </button>
        </div>
      </Modal>
    </>
  );
}
