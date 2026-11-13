import { Router } from 'express';
import { createReport } from '../controllers/reportController.js';
import { reportRateLimiter } from '../middlewares/rateLimitMiddleware.js';

const router: Router = Router();

router.post('/', reportRateLimiter, createReport);

export default router;
