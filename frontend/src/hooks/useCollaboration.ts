import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useDocumentStore } from '../store/documentStore';

interface UseCollaborationOptions {
  documentId: string;
  username: string;
}

interface CollaborationState {
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
}

export function useCollaboration({ documentId, username }: UseCollaborationOptions): CollaborationState {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  const setConnectionStatus = useDocumentStore((s) => s.setConnectionStatus);
  const setSyncStatus = useDocumentStore((s) => s.setSyncStatus);

  useEffect(() => {
    if (!documentId || !username) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Build WebSocket URL — Vite proxy will forward /ws/* to the backend
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/documents`;

    // WebsocketProvider connects to wsUrl/{roomName} i.e. /ws/documents/{documentId}
    const provider = new WebsocketProvider(wsUrl, documentId, ydoc, {
      params: { username },
    });
    providerRef.current = provider;

    const handleStatus = ({ status }: { status: string }) => {
      setConnectionStatus(status === 'connected');
    };

    const handleSync = (isSynced: boolean) => {
      setSyncStatus(isSynced);
    };

    provider.on('status', handleStatus);
    provider.on('sync', handleSync);

    return () => {
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
      setConnectionStatus(false);
      setSyncStatus(false);
    };
  }, [documentId, username, setConnectionStatus, setSyncStatus]);

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
  };
}
