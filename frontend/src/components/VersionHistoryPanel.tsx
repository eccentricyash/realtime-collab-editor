import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { useVersionStore } from '../store/versionStore';

interface VersionHistoryPanelProps {
  documentId: string;
}

export default function VersionHistoryPanel({ documentId }: VersionHistoryPanelProps) {
  const { versions, setVersions, previewVersion, setPreview, setOpen } = useVersionStore();
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);

  const fetchVersions = async () => {
    try {
      const res = await apiFetch(`/documents/${documentId}/versions`);
      if (res.ok) setVersions(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  const handlePreview = async (versionId: string) => {
    try {
      const res = await apiFetch(`/versions/${versionId}/preview`);
      if (res.ok) {
        const data = await res.json();
        setPreview(data.html, data.versionNumber);
      }
    } catch {
      // ignore
    }
  };

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    try {
      const res = await apiFetch(`/versions/${versionId}/restore`, { method: 'POST' });
      if (res.ok) {
        setPreview(null, null);
        // Reload page to pick up restored content
        window.location.reload();
      }
    } catch {
      // ignore
    } finally {
      setRestoring(null);
    }
  };

  const handleManualSnapshot = async () => {
    setSnapshotting(true);
    try {
      const res = await apiFetch(`/documents/${documentId}/versions`, { method: 'POST' });
      if (res.ok) await fetchVersions();
    } catch {
      // ignore
    } finally {
      setSnapshotting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Version History</h3>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Manual snapshot button */}
      <div className="px-4 py-2 border-b border-gray-100">
        <button
          onClick={handleManualSnapshot}
          disabled={snapshotting}
          className="w-full px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors font-medium"
        >
          {snapshotting ? 'Saving...' : 'Save snapshot now'}
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No versions yet</p>
        ) : (
          <div className="py-1">
            {versions.map((v) => (
              <div
                key={v.id}
                className={`px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                  previewVersion === v.versionNumber ? 'bg-blue-50' : ''
                }`}
                onClick={() => handlePreview(v.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">v{v.versionNumber}</span>
                  <span className="text-xs text-gray-400">{formatDate(v.createdAt)}</span>
                </div>
                {previewVersion === v.versionNumber && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(v.id);
                    }}
                    disabled={restoring === v.id}
                    className="mt-2 w-full px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                  >
                    {restoring === v.id ? 'Restoring...' : 'Restore this version'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
