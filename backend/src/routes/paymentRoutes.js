import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  recordPayment,
  listPayments,
  listDues,
} from '../controllers/paymentController.js';

const router = Router();

router.use(protect); // both roles can record payments / view dues

router.get('/', listPayments);
router.get('/dues', listDues);
router.post('/', recordPayment);

export default router;
