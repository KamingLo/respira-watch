import { Router } from 'express';
import authRoutes from './routes/authRoutes.js';
import officerRoutes from './routes/officerRoutes.js';
import kelurahanRoutes from './routes/kelurahanRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import mapRoutes from './routes/mapRoutes.js';
import aqiRoutes from './routes/aqiRoutes.js';
import clusterRoutes from './routes/clusterRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const router: Router = Router();

router.use('/auth', authRoutes);
router.use('/officers', officerRoutes);
router.use('/kelurahans', kelurahanRoutes);
router.use('/kelurahan', kelurahanRoutes);
router.use('/reports', reportRoutes);
router.use('/map', mapRoutes);
router.use('/aqi', aqiRoutes);
router.use('/clusters', clusterRoutes);
router.use('/ai', aiRoutes);

export default router;
