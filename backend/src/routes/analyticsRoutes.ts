import { Router } from 'express';
import {
  getFirmsHotspots,
  getRiskScores,
  triggerRiskScoreComputation,
} from '../controllers/analyticsController.js';

const router: Router = Router();

router.get('/risk-scores', getRiskScores);
router.post('/risk-scores/compute', triggerRiskScoreComputation);
router.get('/hotspots', getFirmsHotspots);
router.get('/firms', getFirmsHotspots);

export default router;
