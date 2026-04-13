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
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('ADMIN'), createSection);
router.get('/', getAllSections);
router.get(
  '/current-year/:departmentId',
  authorize('HOD'),
  getCurrentYearsSections
);
router.get('/:id', getSectionById);
router.put('/:id', authorize('ADMIN'), updateSection);
router.delete('/:id', authorize('ADMIN'), deleteSection);
router.patch('/reallocate', authorize('HOD'), moveStudents);

export default router;
