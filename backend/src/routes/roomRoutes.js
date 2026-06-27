import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  listRooms,
  createRoom,
  updateRoom,
  deleteRoom,
} from '../controllers/roomController.js';

const router = Router();

router.use(protect);
router.get('/', listRooms); // both roles can view rooms
router.post('/', authorize('manager'), createRoom);
router.patch('/:id', authorize('manager'), updateRoom);
router.delete('/:id', authorize('manager'), deleteRoom);

export default router;
