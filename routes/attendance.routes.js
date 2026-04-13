import express from 'express';
import {
  markAttendance,
  requestAttendanceChange,
  resolveAttendanceRequest,
  getAttendanceByClassroom
} from '../controllers/attendance.controller.js';

import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/mark', authorize('HOD', 'FACULTY'), markAttendance);
router.get('/view', getAttendanceByClassroom);
router.post('/request-change', authorize('FACULTY'), requestAttendanceChange);
router.patch('/resolve-request', authorize('HOD'), resolveAttendanceRequest);

export default router;
