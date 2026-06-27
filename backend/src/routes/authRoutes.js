import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  login,
  me,
  createUser,
  listUsers,
  setUserActive,
} from '../controllers/authController.js';

const router = Router();

router.post('/login', login);
router.get('/me', protect, me);

// Manager-only user management
router.get('/users', protect, authorize('manager'), listUsers);
router.post('/users', protect, authorize('manager'), createUser);
router.patch('/users/:id/active', protect, authorize('manager'), setUserActive);

export default router;
