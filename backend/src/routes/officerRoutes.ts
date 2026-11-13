import { Router } from 'express';
import {
  createOfficer,
  listOfficers,
  getOfficerById,
  updateOfficer,
  assignKelurahanToOfficer,
  deleteOfficer,
} from '../controllers/officerController.js';
import { authenticateOfficer, authorizeRoles } from '../middlewares/authMiddleware.js';

const router: Router = Router();

router.get('/', authenticateOfficer, listOfficers);

router.get('/:id', authenticateOfficer, getOfficerById);

router.post('/', authenticateOfficer, authorizeRoles('admin'), createOfficer);

router.put('/:id', authenticateOfficer, authorizeRoles('admin'), updateOfficer);
router.patch('/:id', authenticateOfficer, authorizeRoles('admin'), updateOfficer);

router.patch(
  '/:id/assign-kelurahan',
  authenticateOfficer,
  authorizeRoles('admin'),
  assignKelurahanToOfficer
);

router.delete('/:id', authenticateOfficer, authorizeRoles('admin'), deleteOfficer);

export default router;
