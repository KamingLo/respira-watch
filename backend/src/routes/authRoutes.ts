import { Router } from 'express';
import { loginOfficer, getOfficerProfile } from '../controllers/authController.js';
import { authenticateOfficer } from '../middlewares/authMiddleware.js';

const router: Router = Router();

// Endpoint publik untuk login petugas
router.post('/login', loginOfficer);

// Endpoint terproteksi JWT untuk mengecek profil petugas yang sedang login
router.get('/me', authenticateOfficer, getOfficerProfile);

export default router;
