import express from 'express';
import {
  createCurriculum,
  getAllCurriculums,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum
} from '../controllers/curriculum.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protect, authorize('ADMIN'), createCurriculum);
router.get('/', protect, getAllCurriculums);
router.get('/:id', protect, getCurriculumById);
router.put('/:id', protect, authorize('ADMIN'), updateCurriculum);
router.delete('/:id', protect, authorize('ADMIN'), deleteCurriculum);

export default router;
