import { Router } from 'express';
import { loginOfficer, getOfficerProfile } from '../controllers/authController.js';
import { authenticateOfficer } from '../middlewares/authMiddleware.js';

const router: Router = Router();

router.post('/login', loginOfficer);

router.get('/me', authenticateOfficer, getOfficerProfile);

export default router;
