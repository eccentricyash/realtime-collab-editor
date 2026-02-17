import { Router, Response } from 'express';
import * as Y from 'yjs';
import prisma from '../db/prismaClient';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { versionService } from '../services/versionService';
import { documentService } from '../services/documentService';

export const versionRouter = Router();

// GET /api/documents/:id/versions — List versions
versionRouter.get('/:id/versions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const doc = await prisma.document.findUnique({ where: { id }, select: { ownerId: true } });
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }
    if (doc.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' }); return;
    }

    const versions = await versionService.listVersions(id);
    res.json(versions);
  } catch (error) {
    console.error('[API] Error listing versions:', error);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// POST /api/documents/:id/versions — Manual snapshot
versionRouter.post('/:id/versions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const doc = await prisma.document.findUnique({ where: { id }, select: { ownerId: true } });
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }
    if (doc.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' }); return;
    }

    const state = await documentService.loadDocumentState(id);
    if (!state || state.length === 0) {
      res.status(400).json({ error: 'Document has no content to snapshot' }); return;
    }

    const version = await versionService.createSnapshot(id, state);
    res.status(201).json(version);
  } catch (error) {
    console.error('[API] Error creating snapshot:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

// GET /api/versions/:versionId/preview — Get version content
versionRouter.get('/versions/:versionId/preview', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const versionId = Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId;

    const meta = await versionService.getVersionMeta(versionId);
    if (!meta) { res.status(404).json({ error: 'Version not found' }); return; }

    // Verify ownership
    const doc = await prisma.document.findUnique({ where: { id: meta.documentId }, select: { ownerId: true } });
    if (!doc || doc.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' }); return;
    }

    const content = await versionService.getSnapshot(versionId);
    if (!content) { res.status(404).json({ error: 'Version content not found' }); return; }

    // Convert Yjs binary to HTML for preview
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, content);
    const xmlFragment = ydoc.getXmlFragment('default');
    const html = xmlFragment.toString();
    ydoc.destroy();

    res.json({ html, versionNumber: meta.versionNumber });
  } catch (error) {
    console.error('[API] Error previewing version:', error);
    res.status(500).json({ error: 'Failed to preview version' });
  }
});

// POST /api/versions/:versionId/restore — Restore to version
versionRouter.post('/versions/:versionId/restore', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const versionId = Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId;

    const meta = await versionService.getVersionMeta(versionId);
    if (!meta) { res.status(404).json({ error: 'Version not found' }); return; }

    const doc = await prisma.document.findUnique({ where: { id: meta.documentId }, select: { ownerId: true } });
    if (!doc || doc.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' }); return;
    }

    // Snapshot current state as backup before restoring
    const currentState = await documentService.loadDocumentState(meta.documentId);
    if (currentState && currentState.length > 0) {
      await versionService.createSnapshot(meta.documentId, currentState);
    }

    // Get version content and replace document state
    const versionContent = await versionService.getSnapshot(versionId);
    if (!versionContent) { res.status(404).json({ error: 'Version content not found' }); return; }

    await documentService.saveDocumentState(meta.documentId, versionContent);

    res.json({ message: 'Document restored', versionNumber: meta.versionNumber });
  } catch (error) {
    console.error('[API] Error restoring version:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

