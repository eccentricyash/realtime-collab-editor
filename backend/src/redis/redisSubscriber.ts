import { redisSub } from './redisClient';
import { documentHandler } from '../websocket/documentHandler';

class RedisSubscriber {
  private subscribedChannels: Set<string> = new Set();

  constructor() {
    // Use 'messageBuffer' to receive binary data as Buffer (preserves Yjs binary integrity)
    redisSub.on('messageBuffer', (channelBuffer: Buffer, messageBuffer: Buffer) => {
      const channel = channelBuffer.toString('utf-8');
      this.handleMessage(channel, messageBuffer);
    });
  }

  /**
   * Subscribe to Redis channels for a document.
   * Called when the first client connects to a document on this server instance.
   */
  async subscribeToDocument(documentId: string): Promise<void> {
    const editChannel = `document:${documentId}:edits`;
    const presenceChannel = `document:${documentId}:presence`;

    if (!this.subscribedChannels.has(editChannel)) {
      await redisSub.subscribe(editChannel, presenceChannel);
      this.subscribedChannels.add(editChannel);
      this.subscribedChannels.add(presenceChannel);
      console.log(`[RedisSubscriber] Subscribed to document ${documentId}`);
    }
  }

  /**
   * Unsubscribe from Redis channels for a document.
   * Called when the last client disconnects from a document on this server instance.
   */
  async unsubscribeFromDocument(documentId: string): Promise<void> {
    const editChannel = `document:${documentId}:edits`;
    const presenceChannel = `document:${documentId}:presence`;

    if (this.subscribedChannels.has(editChannel)) {
      await redisSub.unsubscribe(editChannel, presenceChannel);
      this.subscribedChannels.delete(editChannel);
      this.subscribedChannels.delete(presenceChannel);
      console.log(`[RedisSubscriber] Unsubscribed from document ${documentId}`);
    }
  }

  private handleMessage(channel: string, data: Buffer): void {
    // Extract documentId from channel: "document:{documentId}:edits" or "document:{documentId}:presence"
    const parts = channel.split(':');
    if (parts.length < 3 || parts[0] !== 'document') return;
    const documentId = parts[1];
    documentHandler.handleRedisMessage(documentId, channel, data);
  }
}

export const redisSubscriber = new RedisSubscriber();
