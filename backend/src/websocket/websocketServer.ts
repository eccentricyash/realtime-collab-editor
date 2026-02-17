import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { documentHandler } from './documentHandler';
import { redisSubscriber } from '../redis/redisSubscriber';
import { documentService } from '../services/documentService';
import type { ConnectedClient } from '../utils/types';

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
}

export function createWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade manually to support path-based routing
  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);

    // Only handle /ws/documents/* paths
    if (url.pathname.startsWith('/ws/documents/')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const extWs = ws as ExtendedWebSocket;
    extWs.isAlive = true;
    const connectionId = uuidv4();

    // Track setup state for this connection
    let documentId: string | null = null;
    let setupComplete = false;
    let closedDuringSetup = false;

    // Buffer messages that arrive before async setup completes.
    // y-websocket sends SyncStep1 immediately on open — without buffering,
    // it would be dropped since ws.on('message') fires before handleConnection finishes.
    const messageQueue: Array<{ data: Buffer | ArrayBuffer | Buffer[]; isBinary: boolean }> = [];

    const processMessage = (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
      if (!isBinary || !documentId) return;
      let uint8: Uint8Array;
      if (data instanceof ArrayBuffer) {
        uint8 = new Uint8Array(data);
      } else if (Array.isArray(data)) {
        uint8 = new Uint8Array(Buffer.concat(data));
      } else {
        uint8 = new Uint8Array(data);
      }
      documentHandler.handleMessage(ws, documentId, connectionId, uint8);
    };

    // Attach handlers IMMEDIATELY — before any async work
    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
      if (!setupComplete) {
        messageQueue.push({ data, isBinary });
        return;
      }
      processMessage(data, isBinary);
    });

    ws.on('close', async () => {
      if (!documentId) {
        // Setup hasn't assigned documentId yet — flag for cleanup after setup
        closedDuringSetup = true;
        return;
      }
      console.log(`[WS] Client ${connectionId} disconnected from document ${documentId}`);
      await documentHandler.handleDisconnect(documentId, connectionId);
      if (!documentHandler.hasClients(documentId)) {
        await redisSubscriber.unsubscribeFromDocument(documentId);
      }
    });

    ws.on('error', (err: Error) => {
      console.error(`[WS] Error for client ${connectionId}:`, err.message);
    });

    try {
      // Parse URL: /ws/documents/{documentId}?username={username}
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const pathSegments = url.pathname.split('/').filter(Boolean);

      if (pathSegments.length < 3 || pathSegments[0] !== 'ws' || pathSegments[1] !== 'documents') {
        ws.close(4000, 'Invalid path. Use /ws/documents/{documentId}');
        return;
      }

      const parsedDocId = pathSegments[2];
      const username = url.searchParams.get('username') || 'Anonymous';

      // Verify document exists
      const docMeta = await documentService.getDocumentMetadata(parsedDocId);
      if (!docMeta) {
        ws.close(4004, 'Document not found');
        return;
      }

      // Get or create user
      const user = await documentService.getOrCreateUser(username);

      // Set documentId now that we've validated it
      documentId = parsedDocId;

      // If WebSocket closed during async setup, clean up and bail
      if (closedDuringSetup) {
        console.log(`[WS] Client ${connectionId} closed during setup for document ${documentId}`);
        return;
      }

      const client: ConnectedClient = {
        ws,
        userId: user.id,
        username: user.username,
        color: user.color,
        documentId,
      };

      // Subscribe to Redis channels for cross-instance sync
      await redisSubscriber.subscribeToDocument(documentId);

      // Initialize connection: load doc, send sync messages
      await documentHandler.handleConnection(ws, documentId, connectionId, client);

      console.log(`[WS] Client ${connectionId} (${username}) connected to document ${documentId}`);

      // Mark setup complete and replay any buffered messages
      setupComplete = true;
      for (const msg of messageQueue) {
        processMessage(msg.data, msg.isBinary);
      }
      messageQueue.length = 0;

      // If WebSocket closed while we were finishing setup, handle disconnect
      if (closedDuringSetup) {
        console.log(`[WS] Client ${connectionId} closed during setup for document ${documentId}`);
        await documentHandler.handleDisconnect(documentId, connectionId);
        if (!documentHandler.hasClients(documentId)) {
          await redisSubscriber.unsubscribeFromDocument(documentId);
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[WS] Connection setup failed for ${connectionId}:`, errMsg);
      ws.close(4001, 'Internal server error');
    }
  });

  // Heartbeat: detect dead connections via ping/pong
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const extWs = ws as ExtendedWebSocket;
      if (!extWs.isAlive) {
        extWs.terminate();
        return;
      }
      extWs.isAlive = false;
      extWs.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  // Track pong responses
  wss.on('connection', (ws: WebSocket) => {
    const extWs = ws as ExtendedWebSocket;
    extWs.isAlive = true;
    extWs.on('pong', () => {
      extWs.isAlive = true;
    });
  });

  console.log('[WS] WebSocket server initialized');
  return wss;
}
