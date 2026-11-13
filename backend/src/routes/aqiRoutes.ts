import { Router } from 'express';
import { getAqiByCoordinates } from '../controllers/aqiController.js';

const router: Router = Router();

router.get('/', getAqiByCoordinates);

export default router;
