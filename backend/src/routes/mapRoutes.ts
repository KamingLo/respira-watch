import { Router } from 'express';
import { getPublicMap } from '../controllers/reportController.js';

const router: Router = Router();

// GET /api/map (atau /map) — Peta Publik (Titik Ter-Jitter 100-200m & Heatmap dengan Redis Cache)
router.get('/', getPublicMap);

export default router;
