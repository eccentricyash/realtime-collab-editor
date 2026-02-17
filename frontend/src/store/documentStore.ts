import { create } from 'zustand';
import { apiFetch } from '../utils/api';

interface DocumentMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectedUser {
  userId: string;
  username: string;
  color: string;
}

interface DocumentState {
  documents: DocumentMeta[];
  isLoadingDocuments: boolean;
  currentDocumentId: string | null;
  currentDocumentTitle: string | null;
  connectedUsers: ConnectedUser[];
  isConnected: boolean;
  isSynced: boolean;

  setDocuments: (docs: DocumentMeta[]) => void;
  setLoadingDocuments: (loading: boolean) => void;
  setCurrentDocument: (id: string | null, title: string | null) => void;
  setConnectedUsers: (users: ConnectedUser[]) => void;
  setConnectionStatus: (connected: boolean) => void;
  setSyncStatus: (synced: boolean) => void;
  fetchDocuments: () => Promise<void>;
  createDocument: (title: string) => Promise<DocumentMeta | null>;
  deleteDocument: (id: string) => Promise<void>;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  isLoadingDocuments: false,
  currentDocumentId: null,
  currentDocumentTitle: null,
  connectedUsers: [],
  isConnected: false,
  isSynced: false,

  setDocuments: (docs) => set({ documents: docs }),
  setLoadingDocuments: (loading) => set({ isLoadingDocuments: loading }),
  setCurrentDocument: (id, title) => set({ currentDocumentId: id, currentDocumentTitle: title }),
  setConnectedUsers: (users) => set({ connectedUsers: users }),
  setConnectionStatus: (connected) => set({ isConnected: connected }),
  setSyncStatus: (synced) => set({ isSynced: synced }),

  fetchDocuments: async () => {
    set({ isLoadingDocuments: true });
    try {
      const res = await apiFetch('/documents');
      if (!res.ok) throw new Error('Failed to fetch');
      const docs: DocumentMeta[] = await res.json();
      set({ documents: docs });
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      set({ isLoadingDocuments: false });
    }
  },

  createDocument: async (title: string) => {
    try {
      const res = await apiFetch('/documents', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to create');
      const doc: DocumentMeta = await res.json();
      set((state) => ({ documents: [doc, ...state.documents] }));
      return doc;
    } catch (error) {
      console.error('Failed to create document:', error);
      return null;
    }
  },

  deleteDocument: async (id: string) => {
    try {
      await apiFetch(`/documents/${id}`, { method: 'DELETE' });
      set((state) => ({ documents: state.documents.filter((d) => d.id !== id) }));
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  },
}));
