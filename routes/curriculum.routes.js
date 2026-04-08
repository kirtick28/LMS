import express from 'express';
import {
  createCurriculum,
  getAllCurriculums,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum
} from '../controllers/curriculum.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('ADMIN'), createCurriculum);
router.get('/', getAllCurriculums);
router.get('/:id', getCurriculumById);
router.put('/:id', authorize('ADMIN'), updateCurriculum);
router.delete('/:id', authorize('ADMIN'), deleteCurriculum);

export default router;
