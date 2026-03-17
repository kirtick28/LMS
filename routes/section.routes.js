import express from 'express';
import {
  createSection,
  getAllSections,
  getSectionById,
  updateSection,
  deleteSection,
  getCurrentYearsSections,
  moveStudents
} from '../controllers/section.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protect, authorize('ADMIN'), createSection);
router.get('/', protect, getAllSections);
router.get('/current-year', protect, authorize('HOD'), getCurrentYearsSections);
router.get('/:id', protect, getSectionById);
router.put('/:id', protect, authorize('ADMIN'), updateSection);
router.delete('/:id', protect, authorize('ADMIN'), deleteSection);
router.patch('/reallocate', protect, authorize('HOD'), moveStudents);

export default router;
