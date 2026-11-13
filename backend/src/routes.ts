import { Router } from 'express';
import authRoutes from './routes/authRoutes.js';
import officerRoutes from './routes/officerRoutes.js';
import kelurahanRoutes from './routes/kelurahanRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import mapRoutes from './routes/mapRoutes.js';
import aqiRoutes from './routes/aqiRoutes.js';

const router: Router = Router();

router.use('/auth', authRoutes);
router.use('/officers', officerRoutes);
router.use('/kelurahans', kelurahanRoutes);
router.use('/kelurahan', kelurahanRoutes);
router.use('/reports', reportRoutes);
router.use('/map', mapRoutes);
router.use('/aqi', aqiRoutes);

export default router;

