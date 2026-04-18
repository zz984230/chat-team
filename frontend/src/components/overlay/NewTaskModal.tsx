import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useUiStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import { ROOMS } from '../../data/mapConfig';
import type { SessionMode } from '../../types';

export function NewTaskModal() {
  const open = useUiStore((s) => s.newTaskModalOpen);
  const roomId = useUiStore((s) => s.newTaskRoom);
  const close = useUiStore((s) => s.closeNewTaskModal);
  const createSession = useSessionStore((s) => s.createSession);

  const [requirement, setRequirement] = useState('');
  const [mode, setMode] = useState<SessionMode>('default');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomName = roomId ? ROOMS.find((r) => r.id === roomId)?.name : '';

  const handleSubmit = async () => {
    if (!requirement.trim() || !roomId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSession(requirement.trim(), mode, roomId);
      setRequirement('');
      setMode('default');
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={`提交新需求${roomName ? ` — ${roomName}` : ''}`}>
      <textarea
        className="w-full bg-gray-900 text-white rounded-lg p-3 border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
        rows={4}
        placeholder="描述你的需求..."
        value={requirement}
        onChange={(e) => setRequirement(e.target.value)}
      />
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      <div className="flex items-center gap-3 mt-4">
        <select
          className="bg-gray-900 text-white rounded-lg px-3 py-2 border border-gray-600"
          value={mode}
          onChange={(e) => setMode(e.target.value as SessionMode)}
        >
          <option value="default">默认模式（四角色流程）</option>
          <option value="brainstorm">头脑风暴</option>
        </select>
        <button
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg disabled:opacity-50"
          disabled={submitting || !requirement.trim()}
          onClick={handleSubmit}
        >
          {submitting ? '启动中...' : '启动'}
        </button>
      </div>
    </Modal>
  );
}
