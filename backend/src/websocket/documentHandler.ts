import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type WebSocket from 'ws';
import { documentService } from '../services/documentService';
import { redisPub } from '../redis/redisClient';
import { MESSAGE_SYNC, MESSAGE_AWARENESS, type ConnectedClient, type DocumentRoom } from '../utils/types';

const SERVER_ID = process.env.SERVER_ID || 'server-' + Math.random().toString(36).substring(2, 11);
const SAVE_DEBOUNCE_MS = 5000;
const SEPARATOR = 0x7C; // '|' character code

class DocumentHandler {
  private docs: Map<string, Y.Doc> = new Map();
  private rooms: Map<string, DocumentRoom> = new Map();
  private awarenesses: Map<string, awarenessProtocol.Awareness> = new Map();
  private pendingDocs: Map<string, Promise<Y.Doc>> = new Map();

  async getOrCreateDoc(documentId: string): Promise<Y.Doc> {
    const existing = this.docs.get(documentId);
    if (existing) return existing;

    // Async deduplication: if another call is already loading this doc, wait for it
    const pending = this.pendingDocs.get(documentId);
    if (pending) return pending;

    const promise = this.loadDoc(documentId);
    this.pendingDocs.set(documentId, promise);

    try {
      const doc = await promise;
      return doc;
    } finally {
      this.pendingDocs.delete(documentId);
    }
  }

  private async loadDoc(documentId: string): Promise<Y.Doc> {
    const doc = new Y.Doc();

    // Load persisted state from PostgreSQL
    const savedState = await documentService.loadDocumentState(documentId);
    if (savedState && savedState.length > 0) {
      Y.applyUpdate(doc, savedState);
    }

    // Listen for updates from local clients
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      // Only broadcast and persist if the update came from a WebSocket client
      // Skip if origin is 'redis' (cross-instance) or 'persistence' (internal)
      if (origin !== 'redis' && origin !== 'persistence') {
        this.broadcastUpdate(documentId, update, origin);
        this.publishToRedis(documentId, update);
        this.scheduleSave(documentId);
      }
    });

    this.docs.set(documentId, doc);
    this.rooms.set(documentId, {
      docId: documentId,
      clients: new Map(),
      saveTimeout: null,
      lastSavedAt: Date.now(),
    });

    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changedClients = [...added, ...updated, ...removed];
      const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
      this.broadcastAwarenessFromLocal(documentId, encodedUpdate);
      this.publishAwarenessToRedis(documentId, encodedUpdate);
    });
    this.awarenesses.set(documentId, awareness);

    console.log(`[DocumentHandler] Loaded document ${documentId}`);
    return doc;
  }

  async handleConnection(
    ws: WebSocket,
    documentId: string,
    connectionId: string,
    client: ConnectedClient
  ): Promise<void> {
    const doc = await this.getOrCreateDoc(documentId);
    const room = this.rooms.get(documentId)!;
    const awareness = this.awarenesses.get(documentId)!;

    room.clients.set(connectionId, client);

    // Send SyncStep1 (server's state vector) + SyncStep2 (full document state).
    // Sending both ensures the client gets the full document immediately,
    // even if the client's own SyncStep1 was buffered or delayed.
    const encoder1 = encoding.createEncoder();
    encoding.writeVarUint(encoder1, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder1, doc);
    const msg1 = encoding.toUint8Array(encoder1);
    if (ws.readyState === ws.OPEN) {
      ws.send(msg1, { binary: true });
    }

    const encoder2 = encoding.createEncoder();
    encoding.writeVarUint(encoder2, MESSAGE_SYNC);
    syncProtocol.writeSyncStep2(encoder2, doc);
    const msg2 = encoding.toUint8Array(encoder2);
    if (ws.readyState === ws.OPEN) {
      ws.send(msg2, { binary: true });
    }

    // Send current awareness states
    const awarenessStates = awareness.getStates();
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()))
      );
      const awarenessMsg = encoding.toUint8Array(awarenessEncoder);
      if (ws.readyState === ws.OPEN) {
        ws.send(awarenessMsg, { binary: true });
      }
    }

    console.log(`[DocumentHandler] Client ${connectionId} joined document ${documentId} (${room.clients.size} clients)`);
  }

  handleMessage(
    ws: WebSocket,
    documentId: string,
    _connectionId: string,
    data: Uint8Array
  ): void {
    const doc = this.docs.get(documentId);
    if (!doc) return;

    try {
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
          // If the encoder has response data (e.g. SyncStep2 reply), send it back
          if (encoding.length(encoder) > 1) {
            if (ws.readyState === ws.OPEN) {
              ws.send(encoding.toUint8Array(encoder), { binary: true });
            }
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          const awareness = this.awarenesses.get(documentId);
          if (awareness) {
            const update = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
          }
          break;
        }
      }
    } catch (err) {
      console.error(`[DocumentHandler] Error handling message for ${documentId}:`, err);
    }
  }

  /**
   * Broadcast a Yjs update to all local clients except the origin.
   */
  private broadcastUpdate(documentId: string, update: Uint8Array, origin: unknown): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const [, client] of room.clients) {
      if (client.ws !== origin && client.ws.readyState === client.ws.OPEN) {
        client.ws.send(message, { binary: true });
      }
    }
  }

  /**
   * Broadcast awareness update to all local clients (triggered by awareness 'update' event).
   */
  private broadcastAwarenessFromLocal(documentId: string, update: Uint8Array): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const [, client] of room.clients) {
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(message, { binary: true });
      }
    }
  }

  /**
   * Publish Yjs update to Redis for cross-instance sync.
   */
  private publishToRedis(documentId: string, update: Uint8Array): void {
    const channel = `document:${documentId}:edits`;
    const prefix = Buffer.from(SERVER_ID + '|');
    const payload = Buffer.concat([prefix, Buffer.from(update)]);
    redisPub.publish(channel, payload).catch((err: Error) => {
      console.error('[DocumentHandler] Redis publish error:', err.message);
    });
  }

  /**
   * Publish awareness update to Redis for cross-instance sync.
   */
  private publishAwarenessToRedis(documentId: string, update: Uint8Array): void {
    const channel = `document:${documentId}:presence`;
    const prefix = Buffer.from(SERVER_ID + '|');
    const payload = Buffer.concat([prefix, Buffer.from(update)]);
    redisPub.publish(channel, payload).catch((err: Error) => {
      console.error('[DocumentHandler] Redis awareness publish error:', err.message);
    });
  }

  /**
   * Handle a message received from Redis (from another server instance).
   */
  handleRedisMessage(documentId: string, channel: string, data: Buffer): void {
    // Parse SERVER_ID prefix (format: "serverId|<binary data>")
    const separatorIndex = data.indexOf(SEPARATOR);
    if (separatorIndex === -1) return;

    const sourceServerId = data.subarray(0, separatorIndex).toString('utf-8');
    if (sourceServerId === SERVER_ID) return; // Skip own messages

    const payload = new Uint8Array(data.subarray(separatorIndex + 1));

    if (channel.endsWith(':edits')) {
      const doc = this.docs.get(documentId);
      if (doc) {
        Y.applyUpdate(doc, payload, 'redis');
        // Broadcast to ALL local clients since this came from another server
        this.broadcastUpdateToAll(documentId, payload);
        this.scheduleSave(documentId);
      }
    } else if (channel.endsWith(':presence')) {
      const awareness = this.awarenesses.get(documentId);
      if (awareness) {
        awarenessProtocol.applyAwarenessUpdate(awareness, payload, 'redis');
        // Awareness 'update' event handler will broadcast to local clients
      }
    }
  }

  /**
   * Broadcast to ALL local clients (used for Redis-sourced updates where there's no local origin to exclude).
   */
  private broadcastUpdateToAll(documentId: string, update: Uint8Array): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const [, client] of room.clients) {
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(message, { binary: true });
      }
    }
  }

  /**
   * Schedule a debounced save of document state to PostgreSQL.
   */
  private scheduleSave(documentId: string): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    if (room.saveTimeout) {
      clearTimeout(room.saveTimeout);
    }

    room.saveTimeout = setTimeout(() => {
      this.saveDocument(documentId).catch((err: Error) => {
        console.error(`[DocumentHandler] Save error for ${documentId}:`, err.message);
      });
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Persist document state to PostgreSQL.
   */
  async saveDocument(documentId: string): Promise<void> {
    const doc = this.docs.get(documentId);
    if (!doc) return;

    try {
      const state = Y.encodeStateAsUpdate(doc);
      await documentService.saveDocumentState(documentId, state);

      const room = this.rooms.get(documentId);
      if (room) {
        room.lastSavedAt = Date.now();
        if (room.saveTimeout) {
          clearTimeout(room.saveTimeout);
          room.saveTimeout = null;
        }
      }
      console.log(`[DocumentHandler] Saved document ${documentId}`);
    } catch (err) {
      console.error(`[DocumentHandler] Failed to save document ${documentId}:`, err);
    }
  }

  /**
   * Save all active documents (used during graceful shutdown).
   */
  async saveAllDocuments(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const documentId of this.docs.keys()) {
      promises.push(this.saveDocument(documentId));
    }
    await Promise.allSettled(promises);
  }

  /**
   * Handle client disconnect.
   */
  async handleDisconnect(documentId: string, connectionId: string): Promise<void> {
    const room = this.rooms.get(documentId);
    if (!room) return;

    room.clients.delete(connectionId);
    console.log(`[DocumentHandler] Client ${connectionId} left document ${documentId} (${room.clients.size} remaining)`);

    // If no more clients, save and clean up
    if (room.clients.size === 0) {
      await this.saveDocument(documentId);
      this.cleanupDocument(documentId);
    }
  }

  /**
   * Clean up in-memory state for a document with no connected clients.
   */
  private cleanupDocument(documentId: string): void {
    const doc = this.docs.get(documentId);
    if (doc) {
      doc.destroy();
      this.docs.delete(documentId);
    }

    const awareness = this.awarenesses.get(documentId);
    if (awareness) {
      awareness.destroy();
      this.awarenesses.delete(documentId);
    }

    const room = this.rooms.get(documentId);
    if (room?.saveTimeout) {
      clearTimeout(room.saveTimeout);
    }
    this.rooms.delete(documentId);

    console.log(`[DocumentHandler] Cleaned up document ${documentId}`);
  }

  /**
   * Get list of connected users for a document.
   */
  getConnectedUsers(documentId: string): Array<{ userId: string; username: string; color: string }> {
    const room = this.rooms.get(documentId);
    if (!room) return [];

    const seen = new Set<string>();
    const users: Array<{ userId: string; username: string; color: string }> = [];

    for (const [, client] of room.clients) {
      if (!seen.has(client.userId)) {
        seen.add(client.userId);
        users.push({
          userId: client.userId,
          username: client.username,
          color: client.color,
        });
      }
    }
    return users;
  }

  /**
   * Check if a document room has any connected clients.
   */
  hasClients(documentId: string): boolean {
    const room = this.rooms.get(documentId);
    return room ? room.clients.size > 0 : false;
  }
}

export const documentHandler = new DocumentHandler();
