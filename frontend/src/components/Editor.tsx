import { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useDocumentStore } from '../store/documentStore';
import { useAuthStore } from '../store/authStore';
import { useCommentStore } from '../store/commentStore';
import { API_BASE } from '../utils/api';
import { CommentMark } from '../extensions/CommentMark';
import Toolbar from './Toolbar';
import PresenceList from './PresenceList';

interface EditorProps {
  documentId: string;
  username: string;
  userColor: string;
  permission?: 'owner' | 'edit' | 'view';
  shareToken?: string;
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
  permission = 'owner',
}: {
  collab: CollaborationState;
  username: string;
  userColor: string;
  permission?: 'owner' | 'edit' | 'view';
}) {
  const isViewOnly = permission === 'view';
  const setSidebarOpen = useCommentStore((s) => s.setSidebarOpen);
  const setActiveComment = useCommentStore((s) => s.setActiveComment);

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
        placeholder: isViewOnly ? '' : 'Start writing...',
      }),
      CommentMark,
    ],
    editable: !isViewOnly,
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement;
        const commentSpan = target.closest('[data-comment-id]');
        if (commentSpan) {
          const commentId = commentSpan.getAttribute('data-comment-id');
          if (commentId) {
            setActiveComment(commentId);
            setSidebarOpen(true);
          }
        }
        return false;
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
        {isViewOnly ? (
          <div className="px-3 py-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
              View only
            </span>
          </div>
        ) : (
          <Toolbar editor={editor} />
        )}
        <div className="pr-3">
          <PresenceList provider={collab.provider} currentUsername={username} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto relative">
        <EditorContent editor={editor} />
        {editor && !isViewOnly && (
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100 }}
            shouldShow={({ editor: e }) => {
              return !e.state.selection.empty && !e.isActive('commentMark');
            }}
          >
            <button
              onClick={() => {
                const commentId = crypto.randomUUID();
                editor.chain().focus().setComment(commentId).run();
                setActiveComment(commentId);
                setSidebarOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Comment
            </button>
          </BubbleMenu>
        )}
      </div>
    </div>
  );
}

/**
 * Parent component: manages ydoc + provider lifecycle.
 * Renders CollaborativeEditor only after collab is ready.
 */
export default function Editor({ documentId, username, userColor, permission, shareToken }: EditorProps) {
  const setConnectionStatus = useDocumentStore((s) => s.setConnectionStatus);
  const setSyncStatus = useDocumentStore((s) => s.setSyncStatus);

  const [collab, setCollab] = useState<CollaborationState | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl = getWsUrl();

    const params: Record<string, string> = {};
    if (shareToken) {
      params.shareToken = shareToken;
    }
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      params.token = accessToken;
    }

    // Custom WebSocket wrapper: on every reconnect, injects the latest
    // access token from the auth store into the URL query params.
    // This ensures reconnects after token expiry use a fresh token.
    const TokenWebSocket = class extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const urlObj = new URL(url.toString());
        const freshToken = useAuthStore.getState().accessToken;
        if (freshToken) {
          urlObj.searchParams.set('token', freshToken);
        }
        super(urlObj.toString(), protocols);
      }
    };

    const provider = new WebsocketProvider(wsUrl, documentId, ydoc, {
      params,
      WebSocketPolyfill: TokenWebSocket as any,
    });

    // Silently refresh the access token via refresh cookie
    const refreshAccessToken = async (): Promise<void> => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        useAuthStore.getState().setAuth(data.user, data.accessToken);
      } catch {
        // ignore
      }
    };

    const handleStatus = ({ status }: { status: string }) => {
      setConnectionStatus(status === 'connected');
      // On disconnect, refresh token so next reconnect (via TokenWebSocket) has a valid one
      if (status === 'disconnected') {
        refreshAccessToken();
      }
    };
    const handleSync = (isSynced: boolean) => {
      setSyncStatus(isSynced);
    };

    provider.on('status', handleStatus);
    provider.on('sync', handleSync);

    if (provider.synced) {
      setSyncStatus(true);
    }

    // Proactively refresh token every 13 minutes (token expires at 15 min)
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    refreshInterval = setInterval(refreshAccessToken, 13 * 60 * 1000);

    setCollab({ ydoc, provider });

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);
      provider.destroy();
      ydoc.destroy();
      setCollab(null);
      setConnectionStatus(false);
      setSyncStatus(false);
    };
  }, [documentId, username, shareToken, setConnectionStatus, setSyncStatus]);

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
      permission={permission}
    />
  );
}
