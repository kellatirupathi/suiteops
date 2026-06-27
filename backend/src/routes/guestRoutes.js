import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  listGuests,
  getGuest,
  checkIn,
  updateGuest,
  checkOut,
} from '../controllers/guestController.js';

const router = Router();

router.use(protect); // both roles handle guests

router.get('/', listGuests);
router.get('/:id', getGuest);
router.post('/', checkIn);
router.patch('/:id', updateGuest);
router.post('/:id/checkout', checkOut);

export default router;
