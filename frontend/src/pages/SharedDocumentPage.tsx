import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor from '../components/Editor';
import { useDocumentStore } from '../store/documentStore';
import { useAuthStore } from '../store/authStore';
import { API_BASE } from '../utils/api';

interface SharedInfo {
  document: { id: string; title: string };
  permission: 'view' | 'edit';
  shareToken: string;
}

export default function SharedDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const { isConnected, isSynced } = useDocumentStore();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [sharedInfo, setSharedInfo] = useState<SharedInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to silently refresh auth on mount (user may be logged in)
  useEffect(() => {
    if (!isAuthenticated) {
      fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) useAuthStore.getState().setAuth(data.user, data.accessToken);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_BASE}/shared/${token}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 410) throw new Error('This share link has expired.');
          throw new Error('Share link not found.');
        }
        return res.json();
      })
      .then((data: SharedInfo) => {
        setSharedInfo(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const anonColor = useMemo(() => {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  // Use logged-in user's info if available, otherwise anonymous
  const displayName = user?.username || 'Anonymous';
  const displayColor = user?.color || anonColor;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading shared document...</div>
      </div>
    );
  }

  if (error || !sharedInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-4">{error || 'Something went wrong'}</p>
          <Link to="/login" className="text-blue-600 hover:text-blue-700 text-sm">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold text-gray-900 truncate max-w-md">
              {sharedInfo.document.title}
            </h1>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                sharedInfo.permission === 'edit'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {sharedInfo.permission === 'edit' ? 'Can edit' : 'View only'}
            </span>
          </div>

          <div className="flex items-center gap-4">
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
            <span className="text-xs text-gray-400">{displayName}</span>
          </div>
        </div>
      </header>

      {/* Editor */}
      <main className="flex-1 flex justify-center py-6 px-4">
        <div
          className="w-full max-w-4xl bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
          style={{ minHeight: '600px' }}
        >
          <Editor
            documentId={sharedInfo.document.id}
            username={displayName}
            userColor={displayColor}
            permission={sharedInfo.permission}
            shareToken={isAuthenticated ? undefined : sharedInfo.shareToken}
          />
        </div>
      </main>
    </div>
  );
}
