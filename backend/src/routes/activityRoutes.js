import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { listActivity } from '../controllers/activityController.js';

const router = Router();

// audit trail is for management accountability -> manager-only
router.use(protect);
router.get('/', authorize('manager'), listActivity);

export default router;
