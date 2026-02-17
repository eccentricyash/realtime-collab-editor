import { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useDocumentStore } from '../store/documentStore';
import { useAuthStore } from '../store/authStore';
import Toolbar from './Toolbar';
import PresenceList from './PresenceList';

interface EditorProps {
  documentId: string;
  username: string;
  userColor: string;
}

interface CollaborationState {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
}

function getWsUrl(): string {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (import.meta.env.DEV) {
    return `${wsProtocol}//localhost:3001/ws/documents`;
  }
  // In production, use VITE_BACKEND_URL if set (e.g. Render backend URL)
  const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').trim();
  if (backendUrl) {
    const host = backendUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}//${host}/ws/documents`;
  }
  return `${wsProtocol}//${window.location.host}/ws/documents`;
}

/**
 * Child component: only mounts when collab is ready.
 * This ensures useEditor always has the Collaboration extension
 * and avoids the race condition of editor recreation during sync.
 */
function CollaborativeEditor({
  collab,
  username,
  userColor,
}: {
  collab: CollaborationState;
  username: string;
  userColor: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Collaboration.configure({
        document: collab.ydoc,
      }),
      CollaborationCursor.configure({
        provider: collab.provider,
        user: {
          name: username,
          color: userColor,
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
  });

  // Update cursor user info if username/color changes
  const updateUser = useCallback(() => {
    collab.provider.awareness.setLocalStateField('user', {
      name: username,
      color: userColor,
    });
  }, [collab, username, userColor]);

  useEffect(() => {
    updateUser();
  }, [updateUser]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50">
        <Toolbar editor={editor} />
        <div className="pr-3">
          <PresenceList provider={collab.provider} currentUsername={username} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/**
 * Parent component: manages ydoc + provider lifecycle.
 * Renders CollaborativeEditor only after collab is ready.
 */
export default function Editor({ documentId, username, userColor }: EditorProps) {
  const setConnectionStatus = useDocumentStore((s) => s.setConnectionStatus);
  const setSyncStatus = useDocumentStore((s) => s.setSyncStatus);

  const [collab, setCollab] = useState<CollaborationState | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl = getWsUrl();

    const token = useAuthStore.getState().accessToken;
    const provider = new WebsocketProvider(wsUrl, documentId, ydoc, {
      params: token ? { token } : { username },
    });

    const handleStatus = ({ status }: { status: string }) => {
      setConnectionStatus(status === 'connected');
    };
    const handleSync = (isSynced: boolean) => {
      setSyncStatus(isSynced);
    };

    provider.on('status', handleStatus);
    provider.on('sync', handleSync);

    if (provider.synced) {
      setSyncStatus(true);
    }

    setCollab({ ydoc, provider });

    return () => {
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);
      provider.destroy();
      ydoc.destroy();
      setCollab(null);
      setConnectionStatus(false);
      setSyncStatus(false);
    };
  }, [documentId, username, setConnectionStatus, setSyncStatus]);

  if (!collab) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Connecting...
      </div>
    );
  }

  return (
    <CollaborativeEditor
      collab={collab}
      username={username}
      userColor={userColor}
    />
  );
}
