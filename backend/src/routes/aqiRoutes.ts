import { Router } from 'express';
import { getAqiByCoordinates } from '../controllers/aqiController.js';

const router: Router = Router();

// GET /api/aqi?lat=...&lng=... — Kartu Hasil AQI & Status Area berdasarkan GridCell terdekat ($near)
router.get('/', getAqiByCoordinates);

export default router;
