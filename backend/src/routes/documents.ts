import { Router, Response } from 'express';
import prisma from '../db/prismaClient';
import { requireAuth, AuthRequest } from '../middleware/auth';

// Protected share management routes (mounted at /api/documents)
export const documentShareRouter = Router();

// POST /api/documents/:id/share — Create share link
documentShareRouter.post('/:id/share', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { permission } = req.body as { permission?: string };

    if (!permission || !['view', 'edit'].includes(permission)) {
      res.status(400).json({ error: 'Permission must be "view" or "edit"' });
      return;
    }

    // Verify ownership
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    if (doc.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Only the owner can share this document' });
      return;
    }

    const share = await prisma.documentShare.create({
      data: {
        documentId: id,
        permission,
        createdBy: req.user!.userId,
      },
    });

    res.status(201).json({
      id: share.id,
      token: share.token,
      permission: share.permission,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
    });
  } catch (error) {
    console.error('[API] Error creating share:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// GET /api/documents/:id/shares — List shares (owner only)
documentShareRouter.get('/:id/shares', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    if (doc.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Only the owner can view shares' });
      return;
    }

    const shares = await prisma.documentShare.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, token: true, permission: true, createdAt: true, expiresAt: true },
    });

    res.json(shares);
  } catch (error) {
    console.error('[API] Error listing shares:', error);
    res.status(500).json({ error: 'Failed to list shares' });
  }
});

// DELETE /api/documents/:id/shares/:shareId — Revoke share
documentShareRouter.delete('/:id/shares/:shareId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const shareId = Array.isArray(req.params.shareId) ? req.params.shareId[0] : req.params.shareId;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    if (doc.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Only the owner can revoke shares' });
      return;
    }

    await prisma.documentShare.delete({ where: { id: shareId } });
    res.status(204).send();
  } catch (error) {
    console.error('[API] Error revoking share:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

// Public share access route (mounted at /api)
export const sharedAccessRouter = Router();

// GET /api/shared/:token — Access shared document (public)
sharedAccessRouter.get('/shared/:token', async (req, res: Response) => {
  try {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

    const share = await prisma.documentShare.findUnique({
      where: { token },
      include: {
        document: { select: { id: true, title: true } },
      },
    });

    if (!share) {
      res.status(404).json({ error: 'Share link not found' });
      return;
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      res.status(410).json({ error: 'Share link has expired' });
      return;
    }

    res.json({
      document: share.document,
      permission: share.permission,
      shareToken: share.token,
    });
  } catch (error) {
    console.error('[API] Error accessing share:', error);
    res.status(500).json({ error: 'Failed to access shared document' });
  }
});
