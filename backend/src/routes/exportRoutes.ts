import { Router } from 'express';
import { exportClusterCsv } from '../controllers/exportController.js';

const router: Router = Router();

router.get('/:clusterId', exportClusterCsv);

export default router;
