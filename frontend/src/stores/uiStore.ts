import { create } from 'zustand';

interface DocViewerTarget {
  sessionId: string;
  filename: string;
}

interface UiState {
  newTaskModalOpen: boolean;
  agentDetailPanel: string | null;
  docViewer: DocViewerTarget | null;
  archiveDrawerOpen: boolean;

  openNewTaskModal: () => void;
  closeNewTaskModal: () => void;
  openAgentDetail: (agentId: string) => void;
  closeAgentDetail: () => void;
  openDocViewer: (target: DocViewerTarget) => void;
  closeDocViewer: () => void;
  openArchiveDrawer: () => void;
  closeArchiveDrawer: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  newTaskModalOpen: false,
  agentDetailPanel: null,
  docViewer: null,
  archiveDrawerOpen: false,

  openNewTaskModal: () => set({ newTaskModalOpen: true }),
  closeNewTaskModal: () => set({ newTaskModalOpen: false }),
  openAgentDetail: (agentId) => set({ agentDetailPanel: agentId }),
  closeAgentDetail: () => set({ agentDetailPanel: null }),
  openDocViewer: (target) => set({ docViewer: target }),
  closeDocViewer: () => set({ docViewer: null }),
  openArchiveDrawer: () => set({ archiveDrawerOpen: true }),
  closeArchiveDrawer: () => set({ archiveDrawerOpen: false }),
}));
