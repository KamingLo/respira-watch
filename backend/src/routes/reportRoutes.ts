import { Router } from 'express';
import {
  createReport,
  getOfficerReports,
  updateOfficerReportStatusController,
} from '../controllers/reportController.js';
import { reportRateLimiter } from '../middlewares/rateLimitMiddleware.js';
import { authenticateOfficer, authorizeRoles } from '../middlewares/authMiddleware.js';

const router: Router = Router();

router.post('/', reportRateLimiter, createReport);
router.get(
  '/',
  authenticateOfficer,
  authorizeRoles('admin', 'field_officer', 'health_analyst'),
  getOfficerReports
);
router.patch(
  '/:id/status',
  authenticateOfficer,
  authorizeRoles('admin', 'field_officer', 'health_analyst'),
  updateOfficerReportStatusController
);

export default router;
