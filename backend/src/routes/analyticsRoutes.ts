import { Router } from 'express';
import {
  getFirmsHotspots,
  getCurrentWeather,
  getRiskScores,
  triggerRiskScoreComputation,
} from '../controllers/analyticsController.js';

const router: Router = Router();

router.get('/risk-scores', getRiskScores);
router.get('/weather', getCurrentWeather);
router.post('/risk-scores/compute', triggerRiskScoreComputation);
router.get('/hotspots', getFirmsHotspots);
router.get('/firms', getFirmsHotspots);

export default router;
