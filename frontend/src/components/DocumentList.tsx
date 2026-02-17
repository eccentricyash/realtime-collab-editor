import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../store/documentStore';
import ShareModal from './ShareModal';

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg animate-pulse">
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-gray-200 rounded w-48 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-32" />
      </div>
    </div>
  );
}

export default function DocumentList() {
  const { documents, isLoadingDocuments, fetchDocuments, createDocument, deleteDocument } =
    useDocumentStore();
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title || isCreating) return;

    setIsCreating(true);
    try {
      const doc = await createDocument(title);
      if (doc) {
        setNewTitle('');
        navigate(`/documents/${doc.id}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    setDeletingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Create new document */}
      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="New document title..."
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isCreating}
        />
        <button
          onClick={handleCreate}
          disabled={!newTitle.trim() || isCreating}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </div>

      {/* Document list */}
      {isLoadingDocuments ? (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto mb-4 text-gray-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p className="text-gray-500 text-lg font-medium">No documents yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first document to start collaborating</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              to={`/documents/${doc.id}`}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-gray-300 transition-all group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <svg className="text-gray-400 flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div className="min-w-0">
                  <h3 className="text-base font-medium text-gray-800 group-hover:text-blue-600 truncate">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Last edited {formatDate(doc.updatedAt)}
                  </p>
                </div>
              </div>

              {deletingId === doc.id ? (
                <div className="flex items-center gap-2 ml-4" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSharingId(doc.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors rounded hover:bg-blue-50"
                    title="Share document"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeletingId(doc.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50"
                    title="Delete document"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Share modal */}
      {sharingId && (
        <ShareModal documentId={sharingId} onClose={() => setSharingId(null)} />
      )}
    </div>
  );
}
