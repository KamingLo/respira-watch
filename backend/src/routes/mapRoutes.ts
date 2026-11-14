import { Router } from 'express';
import { getPublicMap } from '../controllers/reportController.js';

const router: Router = Router();

router.get('/', getPublicMap);

export default router;
