import { Router } from 'express';
import { classifyComplaint } from '../controllers/aiController.js';

const router: Router = Router();

router.post('/classify', classifyComplaint);

export default router;
