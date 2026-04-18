import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../../src/stores/uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      newTaskModalOpen: false,
      newTaskRoom: null,
      agentDetailPanel: null,
      docViewer: null,
      roomArchiveOpen: null,
    });
  });

  it('opens and closes new task modal', () => {
    const store = useUiStore.getState();
    expect(store.newTaskModalOpen).toBe(false);

    useUiStore.getState().openNewTaskModal('rd');
    expect(useUiStore.getState().newTaskModalOpen).toBe(true);
    expect(useUiStore.getState().newTaskRoom).toBe('rd');

    useUiStore.getState().closeNewTaskModal();
    expect(useUiStore.getState().newTaskModalOpen).toBe(false);
  });

  it('opens agent detail panel with agent id', () => {
    useUiStore.getState().openAgentDetail('analyst');
    expect(useUiStore.getState().agentDetailPanel).toBe('analyst');

    useUiStore.getState().closeAgentDetail();
    expect(useUiStore.getState().agentDetailPanel).toBeNull();
  });

  it('opens doc viewer with session and filename', () => {
    useUiStore.getState().openDocViewer({ sessionId: 's1', filename: 'doc.md' });
    expect(useUiStore.getState().docViewer).toEqual({ sessionId: 's1', filename: 'doc.md' });

    useUiStore.getState().closeDocViewer();
    expect(useUiStore.getState().docViewer).toBeNull();
  });
});
