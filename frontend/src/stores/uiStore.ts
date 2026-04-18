import { create } from 'zustand';

interface DocViewerTarget {
  sessionId: string;
  filename: string;
}

interface UiState {
  newTaskModalOpen: boolean;
  newTaskRoom: string | null;
  agentDetailPanel: string | null;
  docViewer: DocViewerTarget | null;
  roomArchiveOpen: string | null;

  openNewTaskModal: (roomId: string) => void;
  closeNewTaskModal: () => void;
  openAgentDetail: (agentId: string) => void;
  closeAgentDetail: () => void;
  openDocViewer: (target: DocViewerTarget) => void;
  closeDocViewer: () => void;
  openRoomArchive: (roomId: string) => void;
  closeRoomArchive: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  newTaskModalOpen: false,
  newTaskRoom: null,
  agentDetailPanel: null,
  docViewer: null,
  roomArchiveOpen: null,

  openNewTaskModal: (roomId) => set({ newTaskModalOpen: true, newTaskRoom: roomId }),
  closeNewTaskModal: () => set({ newTaskModalOpen: false, newTaskRoom: null }),
  openAgentDetail: (agentId) => set({ agentDetailPanel: agentId }),
  closeAgentDetail: () => set({ agentDetailPanel: null }),
  openDocViewer: (target) => set({ docViewer: target }),
  closeDocViewer: () => set({ docViewer: null }),
  openRoomArchive: (roomId) => set({ roomArchiveOpen: roomId }),
  closeRoomArchive: () => set({ roomArchiveOpen: null }),
}));
