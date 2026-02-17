import * as Y from 'yjs';
import prisma from '../db/prismaClient';

interface DocumentMeta {
  id: string;
  title: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

class DocumentService {
  async createDocument(title: string, ownerId: string): Promise<DocumentMeta> {
    const ydoc = new Y.Doc();
    const initialState = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    ydoc.destroy();

    return prisma.document.create({
      data: { title, content: initialState, ownerId },
      select: { id: true, title: true, ownerId: true, createdAt: true, updatedAt: true },
    });
  }

  async listDocuments(ownerId: string): Promise<DocumentMeta[]> {
    return prisma.document.findMany({
      where: { ownerId },
      select: { id: true, title: true, ownerId: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getDocumentMetadata(documentId: string): Promise<DocumentMeta | null> {
    return prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, ownerId: true, createdAt: true, updatedAt: true },
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
}

export const documentService = new DocumentService();
