import { Router } from 'express';
import {
  getAqiTrend,
  getAqiByCoordinates,
  getAqiMap,
} from '../controllers/aqiController.js';

const router: Router = Router();

router.get('/trend', getAqiTrend);
router.get('/map', getAqiMap);
router.get('/', getAqiByCoordinates);

export default router;
