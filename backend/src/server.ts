import 'dotenv/config';
import express, { Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import { createWebSocketServer } from './websocket/websocketServer';
import { documentService } from './services/documentService';
import { documentHandler } from './websocket/documentHandler';
import prisma from './db/prismaClient';
import authRouter from './routes/auth';
import { documentShareRouter, sharedAccessRouter } from './routes/documents';
import { requireAuth, AuthRequest } from './middleware/auth';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Trust proxy for rate limiting behind Render's load balancer
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', serverId: process.env.SERVER_ID || 'local' });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Share management routes (protected, under /api/documents)
app.use('/api/documents', documentShareRouter);
// Public shared document access (under /api)
app.use('/api', sharedAccessRouter);

// Protected document routes
app.post('/api/documents', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body as { title?: string };
    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    const doc = await documentService.createDocument(title.trim(), req.user!.userId);
    res.status(201).json(doc);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error creating document:', msg);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

app.get('/api/documents', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const docs = await documentService.listDocuments(req.user!.userId);
    res.json(docs);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error listing documents:', msg);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

app.get('/api/documents/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const doc = await documentService.getDocumentMetadata(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    // Allow access if owner or has share
    if (doc.ownerId !== req.user!.userId) {
      const share = await prisma.documentShare.findFirst({
        where: { documentId: id },
      });
      if (!share) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }
    res.json(doc);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error getting document:', msg);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

app.delete('/api/documents/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    // Only owner can delete
    const doc = await documentService.getDocumentMetadata(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    if (doc.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Only the owner can delete this document' });
      return;
    }
    await documentService.deleteDocument(id);
    res.status(204).send();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error deleting document:', msg);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Create HTTP server and attach WebSocket server
const httpServer = http.createServer(app);
createWebSocketServer(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`[Server] HTTP + WebSocket server running on port ${PORT}`);
  console.log(`[Server] Server ID: ${process.env.SERVER_ID || 'local'}`);
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('[Server] Shutting down gracefully...');
  try {
    await documentHandler.saveAllDocuments();
    await prisma.$disconnect();
  } catch (err) {
    console.error('[Server] Error during shutdown:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
