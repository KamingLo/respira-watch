import { Router } from 'express';
import {
  getClusters,
  getClusterDetail,
  getClusterTrend,
  updateClusterStatus,
  triggerClusterDetection,
} from '../controllers/clusterController.js';
import { getClusterSummary } from '../controllers/aiController.js';
import { authenticateOfficer, authorizeRoles } from '../middlewares/authMiddleware.js';

const router: Router = Router();

router.get('/', getClusters);
router.post('/detect', triggerClusterDetection);
router.get(
  '/:id/trend',
  authenticateOfficer,
  authorizeRoles('admin', 'field_officer', 'health_analyst'),
  getClusterTrend
);
router.get('/:id/summary', getClusterSummary);
router.get('/:id', getClusterDetail);
router.patch(
  '/:id',
  authenticateOfficer,
  authorizeRoles('admin', 'field_officer', 'health_analyst'),
  updateClusterStatus
);

export default router;
