import { useState } from 'react';
import { Comment, useCommentStore } from '../store/commentStore';
import { useAuthStore } from '../store/authStore';

interface CommentThreadProps {
  comment: Comment;
  onResolve: (id: string) => Promise<void>;
  onUnresolve: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReply: (content: string) => Promise<Comment | null>;
}

export default function CommentThread({ comment, onResolve, onUnresolve, onDelete, onReply }: CommentThreadProps) {
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const currentUser = useAuthStore((s) => s.user);
  const { activeCommentId, setActiveComment } = useCommentStore();
  const isActive = activeCommentId === comment.commentMarkId;

  const handleReply = async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    await onReply(replyText.trim());
    setReplyText('');
    setShowReply(false);
    setSubmitting(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className={`px-4 py-3 transition-colors cursor-pointer ${
        isActive ? 'bg-yellow-50' : 'hover:bg-gray-50'
      }`}
      onClick={() => setActiveComment(isActive ? null : comment.commentMarkId)}
    >
      {/* Top-level comment */}
      <div className="flex items-start gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
          style={{ backgroundColor: comment.user.color }}
        >
          {comment.user.username[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{comment.user.username}</span>
            <span className="text-xs text-gray-400">{formatTime(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{comment.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReply(!showReply);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Reply
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                comment.resolved ? onUnresolve(comment.id) : onResolve(comment.id);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {comment.resolved ? 'Reopen' : 'Resolve'}
            </button>
            {currentUser?.id === comment.userId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(comment.id);
                }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
                style={{ backgroundColor: reply.user.color }}
              >
                {reply.user.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700">{reply.user.username}</span>
                  <span className="text-[10px] text-gray-400">{formatTime(reply.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {showReply && (
        <div className="ml-8 mt-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply();
            }}
          />
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => { setShowReply(false); setReplyText(''); }}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleReply}
              disabled={!replyText.trim() || submitting}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
