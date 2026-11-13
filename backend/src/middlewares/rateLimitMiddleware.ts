import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Request, Response } from 'express';
import { connectRedis, redisClient } from '../config/redis.js';

export const REPORT_COOLDOWN_WINDOW_MS =
  Number(process.env.REPORT_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000; // Default: 1 jam (3.600.000 ms)

export const REPORT_COOLDOWN_MAX_REQUESTS =
  Number(process.env.REPORT_RATE_LIMIT_MAX) || 1; // Default: 1 laporan per jam per device_hash

export const extractDeviceHashFromRequest = (req: Request): string => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const headerHash = req.headers['x-device-hash'];

  const rawHash =
    (typeof body.device_hash === 'string' && body.device_hash.trim()) ||
    (typeof body.deviceHash === 'string' && body.deviceHash.trim()) ||
    (typeof headerHash === 'string' && headerHash.trim()) ||
    '';

  if (rawHash) {
    return rawHash.toLowerCase();
  }

  return `ip:${ipKeyGenerator(req.ip || '127.0.0.1')}`;
};

export const reportRateLimiter = rateLimit({
  windowMs: REPORT_COOLDOWN_WINDOW_MS,
  max: REPORT_COOLDOWN_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  passOnStoreError: true,
  keyGenerator: (req: Request): string => extractDeviceHashFromRequest(req),
  store: new RedisStore({
    prefix: 'rl:reports:device:',
    sendCommand: async (...args: string[]): Promise<RedisReply> => {
      if (redisClient.status === 'wait') {
        await connectRedis();
      }
      const [command, ...commandArgs] = args;
      if (!command) {
        throw new Error('Perintah Redis kosong.');
      }
      return (await redisClient.call(command, ...commandArgs)) as RedisReply;
    },
  }),
  handler: (req: Request, res: Response): void => {
    const deviceKey = extractDeviceHashFromRequest(req);
    res.status(429).json({
      success: false,
      message:
        'Perangkat ini sudah mengirimkan laporan dalam 1 jam terakhir. Silakan tunggu masa cooldown 1 jam berakhir sebelum mengirim atau memperbarui laporan kembali.',
      retryAfterSeconds: Math.ceil(REPORT_COOLDOWN_WINDOW_MS / 1000),
      deviceKey,
    });
  },
});
