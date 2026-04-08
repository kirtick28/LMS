import express from 'express';

import {
  getComponents,
  getTimetableFull,
  saveTimetableFull,
  getFacultyTimetable
} from '../controllers/timeTable.controller.js';

import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('HOD'), saveTimetableFull);
router.get('/', authorize('HOD'), getTimetableFull);
router.get('/components', authorize('HOD'), getComponents);
router.get(
  '/faculty',
  authorize('HOD', 'ADMIN', 'FACULTY'),
  getFacultyTimetable
);

export default router;
