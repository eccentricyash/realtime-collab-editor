import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import Editor from '../components/Editor';
import ShareModal from '../components/ShareModal';
import { useDocument } from '../hooks/useDocument';
import { useDocumentStore } from '../store/documentStore';
import { useAuthStore } from '../store/authStore';

export default function EditorPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const user = useAuthStore((s) => s.user);
  const { currentDocumentTitle, isConnected, isSynced } = useDocumentStore();

  // Load document metadata via REST
  useDocument(documentId || '');

  const [showShareModal, setShowShareModal] = useState(false);

  // Track reconnection to show a brief "Reconnected" toast
  const [showReconnected, setShowReconnected] = useState(false);
  const wasDisconnected = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      wasDisconnected.current = true;
    } else if (wasDisconnected.current && isConnected) {
      wasDisconnected.current = false;
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  const username = user?.username || 'Anonymous';
  const userColor = useMemo(() => {
    return user?.color || '#3B82F6';
  }, [user]);

  if (!documentId) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
            >
              &larr; Documents
            </Link>
            <div className="w-px h-5 bg-gray-200" />
            <h1 className="text-base font-semibold text-gray-900 truncate max-w-md">
              {currentDocumentTitle || 'Loading...'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Share button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
            {/* Connection indicator */}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  isConnected
                    ? isSynced
                      ? 'bg-green-500'
                      : 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-xs text-gray-500">
                {isConnected ? (isSynced ? 'Synced' : 'Syncing...') : 'Disconnected'}
              </span>
            </div>
            <span className="text-xs text-gray-400">{username}</span>
          </div>
        </div>
      </header>

      {/* Connection lost banner */}
      {!isConnected && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2">
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm text-red-700">Connection lost. Reconnecting automatically...</span>
          </div>
        </div>
      )}

      {/* Reconnected toast */}
      {showReconnected && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-2 transition-opacity">
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500 flex-shrink-0">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className="text-sm text-green-700">Reconnected</span>
          </div>
        </div>
      )}

      {/* Editor */}
      <main className="flex-1 flex justify-center py-6 px-4">
        <div className="w-full max-w-4xl bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: '600px' }}>
          <Editor
            documentId={documentId}
            username={username}
            userColor={userColor}
          />
        </div>
      </main>

      {/* Share modal */}
      {showShareModal && (
        <ShareModal documentId={documentId} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
}
