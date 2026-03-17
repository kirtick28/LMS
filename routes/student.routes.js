import express from 'express';
import multer from 'multer';
import {
  addStudent,
  updateStudent,
  deleteStudent,
  getAllStudents,
  uploadMultipleStudents,
  getStudentDepartmentWise,
  getStudentStats,
  semesterShift,
  getSemesterShiftInfo
} from '../controllers/student.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', protect, authorize('ADMIN'), addStudent);
router.put('/:id', protect, authorize('ADMIN'), updateStudent);
router.delete('/:id', protect, authorize('ADMIN'), deleteStudent);
router.get('/', protect, getAllStudents);
router.post(
  '/upload',
  protect,
  authorize('ADMIN'),
  upload.single('file'),
  uploadMultipleStudents
);
router.get('/stats/year-wise', protect, getStudentStats);
router.get('/stats/department-wise', protect, getStudentDepartmentWise);
router.post('/semester-shift', protect, authorize('ADMIN'), semesterShift);
router.get(
  '/semester-shift-info',
  protect,
  authorize('ADMIN'),
  getSemesterShiftInfo
);

export default router;
