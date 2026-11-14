import { Router } from 'express';
import {
  createKelurahan,
  listKelurahans,
  listPublicKelurahans,
  getKelurahanById,
  updateKelurahan,
  deleteKelurahan,
} from '../controllers/kelurahanController.js';
import { authenticateOfficer, authorizeRoles } from '../middlewares/authMiddleware.js';

const router: Router = Router();

router.get('/public', listPublicKelurahans);
router.get('/', authenticateOfficer, listKelurahans);

router.get('/:id', authenticateOfficer, getKelurahanById);

router.post('/', authenticateOfficer, authorizeRoles('admin'), createKelurahan);

router.put('/:id', authenticateOfficer, authorizeRoles('admin'), updateKelurahan);
router.patch('/:id', authenticateOfficer, authorizeRoles('admin'), updateKelurahan);

router.delete('/:id', authenticateOfficer, authorizeRoles('admin'), deleteKelurahan);

export default router;
