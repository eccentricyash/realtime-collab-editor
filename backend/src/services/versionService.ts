import prisma from '../db/prismaClient';

const MAX_VERSIONS_PER_DOC = 50;

class VersionService {
  async createSnapshot(documentId: string, content: Uint8Array): Promise<{ id: string; versionNumber: number; createdAt: Date }> {
    // Get next version number
    const latest = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    const version = await prisma.documentVersion.create({
      data: {
        documentId,
        content: Buffer.from(content),
        versionNumber,
      },
      select: { id: true, versionNumber: true, createdAt: true },
    });

    // Prune old versions beyond limit
    await this.enforceLimit(documentId);

    return version;
  }

  async listVersions(documentId: string): Promise<Array<{ id: string; versionNumber: number; createdAt: Date }>> {
    return prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, createdAt: true },
    });
  }

  async getSnapshot(versionId: string): Promise<Uint8Array | null> {
    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      select: { content: true },
    });
    if (!version) return null;
    return new Uint8Array(version.content);
  }

  async getVersionMeta(versionId: string): Promise<{ id: string; documentId: string; versionNumber: number } | null> {
    return prisma.documentVersion.findUnique({
      where: { id: versionId },
      select: { id: true, documentId: true, versionNumber: true },
    });
  }

  private async enforceLimit(documentId: string): Promise<void> {
    const count = await prisma.documentVersion.count({ where: { documentId } });
    if (count <= MAX_VERSIONS_PER_DOC) return;

    const toDelete = await prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: 'asc' },
      take: count - MAX_VERSIONS_PER_DOC,
      select: { id: true },
    });

    await prisma.documentVersion.deleteMany({
      where: { id: { in: toDelete.map((v) => v.id) } },
    });
  }
}

export const versionService = new VersionService();
