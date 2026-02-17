import { useState } from 'react';
import { useCommentStore } from '../store/commentStore';
import { useComments } from '../hooks/useComments';
import CommentThread from './CommentThread';

interface CommentSidebarProps {
  documentId: string;
}

export default function CommentSidebar({ documentId }: CommentSidebarProps) {
  const { comments, activeCommentId, showResolved, setShowResolved, setSidebarOpen, setActiveComment } = useCommentStore();
  const { resolveComment, unresolveComment, deleteComment, createComment } = useComments(documentId);
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check if the active comment mark has an existing comment thread
  const activeHasThread = activeCommentId && comments.some((c) => c.commentMarkId === activeCommentId);

  const handleNewComment = async () => {
    if (!newCommentText.trim() || !activeCommentId || submitting) return;
    setSubmitting(true);
    await createComment(newCommentText.trim(), activeCommentId);
    setNewCommentText('');
    setSubmitting(false);
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              showResolved ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {showResolved ? 'Resolved' : 'Open'}
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* New comment form (when user just highlighted text) */}
      {activeCommentId && !activeHasThread && (
        <div className="px-4 py-3 border-b border-gray-200 bg-yellow-50">
          <p className="text-xs text-gray-500 mb-2">Add a comment on the selected text:</p>
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Write your comment..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            rows={3}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleNewComment();
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setActiveComment(null);
                setNewCommentText('');
              }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleNewComment}
              disabled={!newCommentText.trim() || submitting}
              className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {submitting ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </div>
      )}

      {/* Comment threads */}
      <div className="flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="text-center py-12 px-4">
            <svg className="mx-auto mb-3 text-gray-300" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm text-gray-400">
              {showResolved ? 'No resolved comments' : 'No comments yet'}
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Select text and click the comment button to add one
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                onResolve={resolveComment}
                onUnresolve={unresolveComment}
                onDelete={deleteComment}
                onReply={(content) => createComment(content, comment.commentMarkId, comment.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
