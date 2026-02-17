import { useState } from 'react';
import DocumentList from '../components/DocumentList';
import { useDocumentStore } from '../store/documentStore';

export default function HomePage() {
  const { currentUsername, setCurrentUsername } = useDocumentStore();
  const [tempUsername, setTempUsername] = useState('');

  // Username prompt if not set
  if (!currentUsername) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold mb-2 text-center text-gray-900">
            Collaborative Editor
          </h1>
          <p className="text-gray-500 mb-6 text-center text-sm">
            Real-time document editing with multiple users
          </p>
          <input
            type="text"
            value={tempUsername}
            onChange={(e) => setTempUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tempUsername.trim()) {
                setCurrentUsername(tempUsername.trim());
              }
            }}
            placeholder="Enter your name..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            autoFocus
          />
          <button
            onClick={() => {
              if (tempUsername.trim()) {
                setCurrentUsername(tempUsername.trim());
              }
            }}
            disabled={!tempUsername.trim()}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Collaborative Editor</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Signed in as <span className="font-medium text-gray-700">{currentUsername}</span>
            </span>
            <button
              onClick={() => {
                localStorage.removeItem('collab_username');
                setCurrentUsername('');
              }}
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
