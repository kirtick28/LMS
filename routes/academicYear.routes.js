import express from 'express';
import {
  createAcademicYear,
  getAllAcademicYears,
  getAcademicYearById,
  updateAcademicYear,
  deleteAcademicYear
} from '../controllers/academicYear.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protect, authorize('ADMIN'), createAcademicYear);
router.get('/', protect, getAllAcademicYears);
router.get('/:id', protect, getAcademicYearById);
router.put('/:id', protect, authorize('ADMIN'), updateAcademicYear);
router.delete('/:id', protect, authorize('ADMIN'), deleteAcademicYear);

export default router;
