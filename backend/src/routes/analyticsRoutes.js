import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { dashboard } from '../controllers/analyticsController.js';

const router = Router();

router.use(protect);
router.get('/dashboard', dashboard); // both roles see operational dashboard

export default router;
