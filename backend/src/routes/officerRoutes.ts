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

// Endpoint untuk melihat daftar seluruh petugas (terproteksi JWT)
router.get('/', authenticateOfficer, listOfficers);

// Endpoint untuk melihat detail satu petugas berdasarkan ID (terproteksi JWT)
router.get('/:id', authenticateOfficer, getOfficerById);

// Endpoint untuk menambahkan petugas baru (khusus role admin)
router.post('/', authenticateOfficer, authorizeRoles('admin'), createOfficer);

// Endpoint untuk memperbarui data petugas berdasarkan ID (khusus role admin)
router.put('/:id', authenticateOfficer, authorizeRoles('admin'), updateOfficer);
router.patch('/:id', authenticateOfficer, authorizeRoles('admin'), updateOfficer);

// Endpoint khusus untuk menempatkan atau melepas penempatan kelurahan petugas (khusus role admin)
router.patch(
  '/:id/assign-kelurahan',
  authenticateOfficer,
  authorizeRoles('admin'),
  assignKelurahanToOfficer
);

// Endpoint untuk menghapus data petugas berdasarkan ID (khusus role admin)
router.delete('/:id', authenticateOfficer, authorizeRoles('admin'), deleteOfficer);

export default router;
