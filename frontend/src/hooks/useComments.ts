import { useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../utils/api';
import { useCommentStore, Comment } from '../store/commentStore';

const POLL_INTERVAL = 10000; // 10 seconds

export function useComments(documentId: string) {
  const { setComments, showResolved } = useCommentStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchComments = useCallback(async () => {
    if (!documentId) return;
    try {
      const res = await apiFetch(`/documents/${documentId}/comments?resolved=${showResolved}`);
      if (res.ok) {
        const data: Comment[] = await res.json();
        setComments(data);
      }
    } catch {
      // ignore
    }
  }, [documentId, showResolved, setComments]);

  useEffect(() => {
    fetchComments();
    intervalRef.current = setInterval(fetchComments, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchComments]);

  const createComment = useCallback(
    async (content: string, commentMarkId: string, parentId?: string) => {
      const res = await apiFetch(`/documents/${documentId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, commentMarkId, parentId }),
      });
      if (res.ok) {
        await fetchComments();
        return (await res.json()) as Comment;
      }
      return null;
    },
    [documentId, fetchComments]
  );

  const resolveComment = useCallback(
    async (commentId: string) => {
      await apiFetch(`/comments/${commentId}/resolve`, { method: 'PATCH' });
      await fetchComments();
    },
    [fetchComments]
  );

  const unresolveComment = useCallback(
    async (commentId: string) => {
      await apiFetch(`/comments/${commentId}/unresolve`, { method: 'PATCH' });
      await fetchComments();
    },
    [fetchComments]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      await apiFetch(`/comments/${commentId}`, { method: 'DELETE' });
      await fetchComments();
    },
    [fetchComments]
  );

  return { fetchComments, createComment, resolveComment, unresolveComment, deleteComment };
}
