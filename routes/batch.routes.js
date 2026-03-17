import express from 'express';
import {
  createBatch,
  getAllBatches,
  getBatchById,
  updateBatch,
  deleteBatch
} from '../controllers/batch.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protect, authorize('ADMIN'), createBatch);
router.get('/', protect, getAllBatches);
router.get('/:id', protect, getBatchById);
router.put('/:id', protect, authorize('ADMIN'), updateBatch);
router.delete('/:id', protect, authorize('ADMIN'), deleteBatch);

export default router;
