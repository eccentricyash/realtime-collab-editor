import type WebSocket from 'ws';

export interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  username: string;
  color: string;
  documentId: string;
  permission: 'owner' | 'edit' | 'view';
}

export interface DocumentRoom {
  docId: string;
  clients: Map<string, ConnectedClient>;
  saveTimeout: ReturnType<typeof setTimeout> | null;
  lastSavedAt: number;
  versionTimeout: ReturnType<typeof setTimeout> | null;
  lastVersionAt: number;
  hasChangedSinceLastVersion: boolean;
}

// Yjs protocol message type prefixes (first byte of binary messages)
export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
export const MESSAGE_VERSION_RESTORE = 3;

// Application-level JSON message types
export enum AppMessageType {
  DOCUMENT_INFO = 'DOCUMENT_INFO',
  ERROR = 'ERROR',
}

export interface DocumentInfoMessage {
  type: AppMessageType.DOCUMENT_INFO;
  documentId: string;
  title: string;
  connectedUsers: Array<{ userId: string; username: string; color: string }>;
}

export interface ErrorMessage {
  type: AppMessageType.ERROR;
  message: string;
}

export type AppMessage = DocumentInfoMessage | ErrorMessage;
