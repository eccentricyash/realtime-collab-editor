import { Router, Response } from 'express';
import prisma from '../db/prismaClient';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const commentRouter = Router();

// GET /api/documents/:id/comments — List comments (with replies)
commentRouter.get('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const resolved = req.query.resolved === 'true';

    const comments = await prisma.comment.findMany({
      where: {
        documentId: id,
        parentId: null, // top-level only
        resolved,
      },
      include: {
        user: { select: { id: true, username: true, color: true } },
        replies: {
          include: {
            user: { select: { id: true, username: true, color: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(comments);
  } catch (error) {
    console.error('[API] Error listing comments:', error);
    res.status(500).json({ error: 'Failed to list comments' });
  }
});

// POST /api/documents/:id/comments — Create comment
commentRouter.post('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { content, commentMarkId, parentId } = req.body as {
      content?: string;
      commentMarkId?: string;
      parentId?: string;
    };

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }
    if (!commentMarkId) {
      res.status(400).json({ error: 'commentMarkId is required' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        documentId: id,
        userId: req.user!.userId,
        content: content.trim(),
        commentMarkId,
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, username: true, color: true } },
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('[API] Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PATCH /api/comments/:id/resolve — Resolve comment
commentRouter.patch('/comments/:id/resolve', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await prisma.comment.update({ where: { id }, data: { resolved: true } });
    res.json({ resolved: true });
  } catch (error) {
    console.error('[API] Error resolving comment:', error);
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

// PATCH /api/comments/:id/unresolve — Unresolve comment
commentRouter.patch('/comments/:id/unresolve', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await prisma.comment.update({ where: { id }, data: { resolved: false } });
    res.json({ resolved: false });
  } catch (error) {
    console.error('[API] Error unresolving comment:', error);
    res.status(500).json({ error: 'Failed to unresolve comment' });
  }
});

// DELETE /api/comments/:id — Delete comment
commentRouter.delete('/comments/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const comment = await prisma.comment.findUnique({ where: { id }, select: { userId: true } });
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }
    if (comment.userId !== req.user!.userId) {
      res.status(403).json({ error: 'You can only delete your own comments' });
      return;
    }

    await prisma.comment.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('[API] Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});
