import { Router } from 'express';
import {
  getClusters,
  getClusterDetail,
  triggerClusterDetection,
} from '../controllers/clusterController.js';

const router: Router = Router();

router.get('/', getClusters);
router.post('/detect', triggerClusterDetection);
router.get('/:id', getClusterDetail);

export default router;
