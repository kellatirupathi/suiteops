import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  listInventory,
  createItem,
  updateItem,
  adjustStock,
  deleteItem,
} from '../controllers/inventoryController.js';

const router = Router();

router.use(protect);

router.get('/', listInventory); // both roles can view stock
router.patch('/:id/adjust', adjustStock); // both roles can adjust stock day-to-day

// management of catalogue is manager-only
router.post('/', authorize('manager'), createItem);
router.patch('/:id', authorize('manager'), updateItem);
router.delete('/:id', authorize('manager'), deleteItem);

export default router;
