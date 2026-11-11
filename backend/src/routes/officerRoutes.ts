import { Router } from 'express';
import {
  createOfficer,
  listOfficers,
  getOfficerById,
} from '../controllers/officerController.js';
import { authenticateOfficer, authorizeRoles } from '../middlewares/authMiddleware.js';

const router: Router = Router();

// Endpoint untuk melihat daftar seluruh petugas (terproteksi JWT)
router.get('/', authenticateOfficer, listOfficers);

// Endpoint untuk melihat detail satu petugas berdasarkan ID (terproteksi JWT)
router.get('/:id', authenticateOfficer, getOfficerById);

// Endpoint untuk menambahkan petugas baru (khusus role admin)
router.post('/', authenticateOfficer, authorizeRoles('admin'), createOfficer);

export default router;
