import express from 'express';
import {
  createBatchProgram,
  getAllBatchPrograms,
  getBatchProgramDetailsByParams,
  getBatchProgramById,
  updateBatchProgram,
  deleteBatchProgram
} from '../controllers/batchProgram.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', protect, authorize('ADMIN'), createBatchProgram);
router.get('/', protect, getAllBatchPrograms);
router.get('/:batchId/:departmentId', protect, getBatchProgramDetailsByParams);
router.get('/:id', protect, getBatchProgramById);
router.put('/:id', protect, authorize('ADMIN'), updateBatchProgram);
router.delete('/:id', protect, authorize('ADMIN'), deleteBatchProgram);

export default router;
