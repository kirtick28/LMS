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
  getSemesterShiftInfo,
} from '../controllers/student.controller.js';

import { getStudentDashboard } from '../controllers/studentDashboard.controller.js';

import {
  getMyAttendanceOverview,
  getFacultyStudentAttendance
} from '../controllers/studentAttendance.controller.js';
import {
  getFacultyAttendanceClasswiseReport,
  downloadFacultyAttendanceClasswiseReport,
  getFacultyAttendanceStudentwiseReport,
  downloadFacultyAttendanceStudentwiseReport
} from '../controllers/facultyAttendanceReport.controller.js';

import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 🔐 Protect all routes
router.use(protect);

// =====================
// ✅ STATIC ROUTES FIRST
// =====================

router.post('/', authorize('ADMIN'), addStudent);
router.get('/', getAllStudents);

router.post(
  '/upload',
  authorize('ADMIN'),
  upload.single('file'),
  uploadMultipleStudents
);

router.get('/stats/year-wise', getStudentStats);
router.get('/stats/department-wise', getStudentDepartmentWise);

router.post('/semester-shift', authorize('ADMIN'), semesterShift);
router.get('/semester-shift-info', authorize('ADMIN'), getSemesterShiftInfo);

router.get('/dashboard', authorize('STUDENT'), getStudentDashboard);

router.get('/attendance', authorize('STUDENT'), getMyAttendanceOverview);

router.get(
  '/faculty/attendance',
  authorize('FACULTY'),
  getFacultyStudentAttendance
);
router.get(
  '/faculty/attendance/classwise/download',
  authorize('FACULTY'),
  downloadFacultyAttendanceClasswiseReport
);
router.get(
  "/faculty/attendance/classwise",
  authorize("FACULTY"),
  getFacultyAttendanceClasswiseReport
);
router.get(
  '/faculty/attendance/studentwise/download',
  authorize('FACULTY'),
  downloadFacultyAttendanceStudentwiseReport
);
router.get(
  "/faculty/attendance/studentwise",
  authorize("FACULTY"),
  getFacultyAttendanceStudentwiseReport
);
// =====================
// ⚠️ DYNAMIC ROUTES LAST
// =====================

router.put('/:id', authorize('ADMIN'), updateStudent);
router.delete('/:id', authorize('ADMIN'), deleteStudent);

export default router;
