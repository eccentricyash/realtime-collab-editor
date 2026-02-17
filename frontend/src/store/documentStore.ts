import { create } from 'zustand';

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
  currentUsername: string;

  setDocuments: (docs: DocumentMeta[]) => void;
  setLoadingDocuments: (loading: boolean) => void;
  setCurrentDocument: (id: string | null, title: string | null) => void;
  setConnectedUsers: (users: ConnectedUser[]) => void;
  setConnectionStatus: (connected: boolean) => void;
  setSyncStatus: (synced: boolean) => void;
  setCurrentUsername: (username: string) => void;
  fetchDocuments: () => Promise<void>;
  createDocument: (title: string) => Promise<DocumentMeta | null>;
  deleteDocument: (id: string) => Promise<void>;
}

const _backendUrl = (import.meta.env.VITE_BACKEND_URL || '').trim();
const API_BASE = _backendUrl ? `${_backendUrl}/api` : '/api';

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  isLoadingDocuments: false,
  currentDocumentId: null,
  currentDocumentTitle: null,
  connectedUsers: [],
  isConnected: false,
  isSynced: false,
  currentUsername: localStorage.getItem('collab_username') || '',

  setDocuments: (docs) => set({ documents: docs }),
  setLoadingDocuments: (loading) => set({ isLoadingDocuments: loading }),
  setCurrentDocument: (id, title) => set({ currentDocumentId: id, currentDocumentTitle: title }),
  setConnectedUsers: (users) => set({ connectedUsers: users }),
  setConnectionStatus: (connected) => set({ isConnected: connected }),
  setSyncStatus: (synced) => set({ isSynced: synced }),
  setCurrentUsername: (username) => {
    localStorage.setItem('collab_username', username);
    set({ currentUsername: username });
  },

  fetchDocuments: async () => {
    set({ isLoadingDocuments: true });
    try {
      const res = await fetch(`${API_BASE}/documents`);
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
      const res = await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
      set((state) => ({ documents: state.documents.filter((d) => d.id !== id) }));
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  },
}));
