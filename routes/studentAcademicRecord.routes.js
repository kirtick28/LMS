import express from 'express';
import {
  createStudentAcademicRecord,
  getAllStudentAcademicRecords,
  getStudentAcademicRecordById,
  updateStudentAcademicRecord,
  deleteStudentAcademicRecord
} from '../controllers/studentAcademicRecord.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('ADMIN'), createStudentAcademicRecord);
router.get('/', getAllStudentAcademicRecords);
router.get('/:id', getStudentAcademicRecordById);
router.put('/:id', authorize('ADMIN'), updateStudentAcademicRecord);
router.delete('/:id', authorize('ADMIN'), deleteStudentAcademicRecord);

export default router;
