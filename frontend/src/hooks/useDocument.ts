import { useEffect } from 'react';
import { useDocumentStore } from '../store/documentStore';

const _backendUrl = (import.meta.env.VITE_BACKEND_URL || '').trim();
const API_BASE = _backendUrl ? `${_backendUrl}/api` : '/api';

export function useDocument(documentId: string): void {
  const setCurrentDocument = useDocumentStore((s) => s.setCurrentDocument);

  useEffect(() => {
    if (!documentId) return;

    let cancelled = false;

    fetch(`${API_BASE}/documents/${documentId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Document not found');
        return res.json();
      })
      .then((doc: { id: string; title: string }) => {
        if (!cancelled) {
          setCurrentDocument(doc.id, doc.title);
        }
      })
      .catch((err) => {
        console.error('Failed to load document metadata:', err);
      });

    return () => {
      cancelled = true;
      setCurrentDocument(null, null);
    };
  }, [documentId, setCurrentDocument]);
}
