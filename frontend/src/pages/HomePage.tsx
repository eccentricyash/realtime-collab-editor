import DocumentList from '../components/DocumentList';
import { useAuthStore } from '../store/authStore';
import { API_BASE } from '../utils/api';

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    clearAuth();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Collaborative Editor</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Signed in as <span className="font-medium text-gray-700">{user?.username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto py-8 px-6">
        <DocumentList />
      </main>
    </div>
  );
}
