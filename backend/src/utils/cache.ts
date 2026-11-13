import { redisClient } from '../config/redis.js';

export const DEFAULT_CACHE_TTL = 300;

export const isRedisReady = (): boolean => redisClient.status === 'ready';

export const buildFilterCacheKey = (
  prefix: string,
  filter: object = {}
): string => {
  const entries = Object.entries(filter as Record<string, unknown>)
    .filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== '')
    .map(([key, val]) => [key, String(val).trim().toLowerCase()] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return `${prefix}:all`;
  }

  const queryPart = entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `${prefix}:${queryPart}`;
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  if (!isRedisReady()) {
    return null;
  }

  try {
    const raw = await redisClient.get(key);
    if (!raw) {
      return null;
    }
    console.log(`[Redis Cache] HIT -> ${key}`);
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[Redis Cache] Gagal membaca cache untuk key "${key}":`, error);
    return null;
  }
};

export const setCache = async (
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_CACHE_TTL
): Promise<void> => {
  if (!isRedisReady()) {
    return;
  }

  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    console.log(`[Redis Cache] SET -> ${key} (TTL: ${ttlSeconds}s)`);
  } catch (error) {
    console.warn(`[Redis Cache] Gagal menyimpan cache untuk key "${key}":`, error);
  }
};

export const deleteCache = async (...keys: string[]): Promise<void> => {
  const validKeys = keys.filter((k) => Boolean(k));
  if (!isRedisReady() || validKeys.length === 0) {
    return;
  }

  try {
    await redisClient.del(...validKeys);
    console.log(`[Redis Cache] DEL -> ${validKeys.join(', ')}`);
  } catch (error) {
    console.warn(`[Redis Cache] Gagal menghapus cache untuk keys [${validKeys.join(', ')}]:`, error);
  }
};

export const deleteCacheByPattern = async (pattern: string): Promise<void> => {
  if (!isRedisReady()) {
    return;
  }

  try {
    let cursor = '0';
    const keysToDelete: string[] = [];

    do {
      const [nextCursor, matchedKeys] = await redisClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      if (matchedKeys.length > 0) {
        keysToDelete.push(...matchedKeys);
      }
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
      await redisClient.del(...keysToDelete);
      console.log(`[Redis Cache] DEL PATTERN (${pattern}) -> ${keysToDelete.join(', ')}`);
    }
  } catch (error) {
    console.warn(`[Redis Cache] Gagal menghapus cache dengan pattern "${pattern}":`, error);
  }
};

export const delCache = async (keyOrPattern: string): Promise<void> => {
  const normalized = keyOrPattern.trim();
  if (!normalized) {
    return;
  }

  if (normalized.includes('*')) {
    await deleteCacheByPattern(normalized);
    return;
  }

  await deleteCache(normalized);
};
