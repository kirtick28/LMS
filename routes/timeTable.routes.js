import express from 'express';

import {
  getComponents,
  getTimetableFull,
  saveTimetableFull,
  getFacultyTimetable
} from '../controllers/timeTable.controller.js';

import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', protect, authorize('HOD'), saveTimetableFull);
router.get('/', protect, authorize('HOD'), getTimetableFull);
router.get('/components', protect, authorize('HOD'), getComponents);
router.get(
  '/faculty',
  protect,
  authorize('HOD', 'ADMIN', 'FACULTY'),
  getFacultyTimetable
);

export default router;
