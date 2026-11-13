import 'dotenv/config';
import { Redis } from 'ioredis';

const redisUrl = (process.env.REDIS_URL || 'redis://127.0.0.1:6379').trim();

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  lazyConnect: true,
});

redisClient.on('connect', () => {
  console.log('[Redis] Terhubung ke server Redis');
});

redisClient.on('error', (err: Error) => {
  console.error('[Redis] Error koneksi Redis:', err.message);
});

let connectingPromise: Promise<void> | null = null;

export const connectRedis = async (): Promise<void> => {
  if (redisClient.status === 'ready' || redisClient.status === 'connect') {
    return;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  if (redisClient.status === 'wait') {
    connectingPromise = redisClient
      .connect()
      .catch((error: unknown) => {
        console.warn('[Redis] Gagal melakukan koneksi awal Redis, berjalan tanpa cache aktif:', error);
      })
      .finally(() => {
        connectingPromise = null;
      });

    await connectingPromise;
  }
};
