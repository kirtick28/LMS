import express from 'express';
import {
  createAcademicYear,
  getAllAcademicYears,
  getAcademicYearById,
  updateAcademicYear,
  deleteAcademicYear
} from '../controllers/academicYear.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('ADMIN'), createAcademicYear);
router.get('/', getAllAcademicYears);
router.get('/:id', getAcademicYearById);
router.put('/:id', authorize('ADMIN'), updateAcademicYear);
router.delete('/:id', authorize('ADMIN'), deleteAcademicYear);

export default router;
