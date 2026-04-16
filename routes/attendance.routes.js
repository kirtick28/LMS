import express from 'express';
import {
  markAttendance,
  requestAttendanceChange,
  resolveAttendanceRequest,
  getAttendanceRequests,
  viewAttendance
} from '../controllers/attendance.controller.js';

import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/mark', authorize('HOD', 'FACULTY'), markAttendance);
router.get('/requests', authorize('HOD'), getAttendanceRequests);
router.get('/view', viewAttendance);
router.post('/request-change', authorize('FACULTY'), requestAttendanceChange);
router.patch('/resolve-request', authorize('HOD'), resolveAttendanceRequest);

export default router;
