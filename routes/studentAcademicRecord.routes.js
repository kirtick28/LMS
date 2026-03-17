import express from 'express';
import {
  createStudentAcademicRecord,
  getAllStudentAcademicRecords,
  getStudentAcademicRecordById,
  updateStudentAcademicRecord,
  deleteStudentAcademicRecord
} from '../controllers/studentAcademicRecord.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protect, authorize('ADMIN'), createStudentAcademicRecord);
router.get('/', protect, getAllStudentAcademicRecords);
router.get('/:id', protect, getStudentAcademicRecordById);
router.put('/:id', protect, authorize('ADMIN'), updateStudentAcademicRecord);
router.delete('/:id', protect, authorize('ADMIN'), deleteStudentAcademicRecord);

export default router;
