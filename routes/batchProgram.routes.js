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

router.use(protect);

router.post('/', authorize('ADMIN'), createBatchProgram);
router.get('/', getAllBatchPrograms);
router.get('/:batchId/:departmentId', getBatchProgramDetailsByParams);
router.get('/:id', getBatchProgramById);
router.put('/:id', authorize('ADMIN'), updateBatchProgram);
router.delete('/:id', authorize('ADMIN'), deleteBatchProgram);

export default router;
