import { Router } from 'express';
import authRoutes from './routes/authRoutes.js';
import officerRoutes from './routes/officerRoutes.js';

const router: Router = Router();

router.use('/auth', authRoutes);
router.use('/officers', officerRoutes);

export default router;
