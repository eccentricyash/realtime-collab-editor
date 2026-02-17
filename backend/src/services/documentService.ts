import * as Y from 'yjs';
import prisma from '../db/prismaClient';

const PRESENCE_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
  '#6366F1', '#06B6D4', '#84CC16', '#E11D48',
];

class DocumentService {
  async createDocument(title: string): Promise<{ id: string; title: string; createdAt: Date; updatedAt: Date }> {
    const ydoc = new Y.Doc();
    const initialState = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    ydoc.destroy();

    return prisma.document.create({
      data: { title, content: initialState },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async listDocuments(): Promise<Array<{ id: string; title: string; createdAt: Date; updatedAt: Date }>> {
    return prisma.document.findMany({
      select: { id: true, title: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getDocumentMetadata(documentId: string): Promise<{ id: string; title: string; createdAt: Date; updatedAt: Date } | null> {
    return prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async loadDocumentState(documentId: string): Promise<Uint8Array | null> {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { content: true },
    });
    if (!doc) return null;
    if (!doc.content) return new Uint8Array(0);
    return new Uint8Array(doc.content);
  }

  async saveDocumentState(documentId: string, state: Uint8Array): Promise<void> {
    await prisma.document.update({
      where: { id: documentId },
      data: { content: Buffer.from(state) },
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    await prisma.document.delete({ where: { id: documentId } });
  }

  async getOrCreateUser(username: string): Promise<{ id: string; username: string; color: string }> {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return existing;

    const hash = Array.from(username).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const color = PRESENCE_COLORS[hash % PRESENCE_COLORS.length];

    return prisma.user.create({
      data: { username, color },
    });
  }
}

export const documentService = new DocumentService();
