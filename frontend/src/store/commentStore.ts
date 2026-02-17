import { create } from 'zustand';

export interface CommentUser {
  id: string;
  username: string;
  color: string;
}

export interface Comment {
  id: string;
  documentId: string;
  userId: string;
  user: CommentUser;
  content: string;
  commentMarkId: string;
  parentId: string | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  replies: Comment[];
}

interface CommentState {
  comments: Comment[];
  isSidebarOpen: boolean;
  activeCommentId: string | null;
  showResolved: boolean;
  setComments: (comments: Comment[]) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveComment: (commentMarkId: string | null) => void;
  setShowResolved: (show: boolean) => void;
}

export const useCommentStore = create<CommentState>((set) => ({
  comments: [],
  isSidebarOpen: false,
  activeCommentId: null,
  showResolved: false,
  setComments: (comments) => set({ comments }),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setActiveComment: (commentMarkId) => set({ activeCommentId: commentMarkId }),
  setShowResolved: (show) => set({ showResolved: show }),
}));
