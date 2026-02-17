import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const retryStrategy = (times: number): number => {
  return Math.min(times * 200, 5000);
};

// Publisher connection: used for publishing messages and regular commands
export const redisPub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy,
  lazyConnect: false,
});

// Subscriber connection: enters subscriber mode, cannot do regular commands
export const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy,
  lazyConnect: false,
});

redisPub.on('error', (err: Error) => console.error('[Redis Publisher Error]', err.message));
redisSub.on('error', (err: Error) => console.error('[Redis Subscriber Error]', err.message));
redisPub.on('connect', () => console.log('[Redis] Publisher connected'));
redisSub.on('connect', () => console.log('[Redis] Subscriber connected'));
