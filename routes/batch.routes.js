import express from 'express';
import {
  createBatch,
  getAllBatches,
  getBatchById,
  updateBatch,
  deleteBatch
} from '../controllers/batch.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('ADMIN'), createBatch);
router.get('/', getAllBatches);
router.get('/:id', getBatchById);
router.put('/:id', authorize('ADMIN'), updateBatch);
router.delete('/:id', authorize('ADMIN'), deleteBatch);

export default router;
