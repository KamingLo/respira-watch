import { Router } from 'express';
import {
  createKelurahan,
  listKelurahans,
  getKelurahanById,
  updateKelurahan,
  deleteKelurahan,
} from '../controllers/kelurahanController.js';
import { authenticateOfficer, authorizeRoles } from '../middlewares/authMiddleware.js';

const router: Router = Router();

// Endpoint untuk melihat daftar seluruh kelurahan (terproteksi JWT)
router.get('/', authenticateOfficer, listKelurahans);

// Endpoint untuk melihat detail satu kelurahan beserta petugas yang ditempatkan (terproteksi JWT)
router.get('/:id', authenticateOfficer, getKelurahanById);

// Endpoint untuk menambahkan data kelurahan baru (khusus role admin)
router.post('/', authenticateOfficer, authorizeRoles('admin'), createKelurahan);

// Endpoint untuk memperbarui data kelurahan berdasarkan ID (khusus role admin)
router.put('/:id', authenticateOfficer, authorizeRoles('admin'), updateKelurahan);
router.patch('/:id', authenticateOfficer, authorizeRoles('admin'), updateKelurahan);

// Endpoint untuk menghapus data kelurahan berdasarkan ID (khusus role admin)
router.delete('/:id', authenticateOfficer, authorizeRoles('admin'), deleteKelurahan);

export default router;
