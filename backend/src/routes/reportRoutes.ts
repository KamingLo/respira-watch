import { Router } from 'express';
import { createReport } from '../controllers/reportController.js';
import { reportRateLimiter } from '../middlewares/rateLimitMiddleware.js';

const router: Router = Router();

// POST /api/reports (atau /reports) — Pelaporan Warga dengan Rate Limit (cooldown 1 jam per device_hash)
router.post('/', reportRateLimiter, createReport);

export default router;
