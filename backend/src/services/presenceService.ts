import { documentHandler } from '../websocket/documentHandler';

class PresenceService {
  getDocumentPresence(documentId: string): Array<{ userId: string; username: string; color: string }> {
    return documentHandler.getConnectedUsers(documentId);
  }
}

export const presenceService = new PresenceService();
