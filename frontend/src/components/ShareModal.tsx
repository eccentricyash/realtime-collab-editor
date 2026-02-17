import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

interface Share {
  id: string;
  token: string;
  permission: string;
  createdAt: string;
  expiresAt: string | null;
}

interface ShareModalProps {
  documentId: string;
  onClose: () => void;
}

export default function ShareModal({ documentId, onClose }: ShareModalProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchShares = async () => {
    try {
      const res = await apiFetch(`/documents/${documentId}/shares`);
      if (res.ok) {
        setShares(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, [documentId]);

  const createShare = async (permission: 'view' | 'edit') => {
    setCreating(true);
    try {
      const res = await apiFetch(`/documents/${documentId}/share`, {
        method: 'POST',
        body: JSON.stringify({ permission }),
      });
      if (res.ok) {
        await fetchShares();
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const revokeShare = async (shareId: string) => {
    try {
      await apiFetch(`/documents/${documentId}/shares/${shareId}`, {
        method: 'DELETE',
      });
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch {
      // ignore
    }
  };

  const getShareUrl = (token: string) => {
    return `${window.location.origin}/shared/${token}`;
  };

  const copyLink = async (token: string, shareId: string) => {
    try {
      await navigator.clipboard.writeText(getShareUrl(token));
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
      const input = document.createElement('input');
      input.value = getShareUrl(token);
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Share Document</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Create share buttons */}
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm text-gray-500 mb-3">Generate a share link:</p>
          <div className="flex gap-2">
            <button
              onClick={() => createShare('view')}
              disabled={creating}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              View only
            </button>
            <button
              onClick={() => createShare('edit')}
              disabled={creating}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              Can edit
            </button>
          </div>
        </div>

        {/* Active shares */}
        <div className="px-6 py-4 max-h-64 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
          ) : shares.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No active share links</p>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        share.permission === 'edit'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {share.permission === 'edit' ? 'Edit' : 'View'}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      {new Date(share.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => copyLink(share.token, share.id)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded hover:bg-blue-50"
                      title="Copy link"
                    >
                      {copiedId === share.id ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => revokeShare(share.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50"
                      title="Revoke"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
