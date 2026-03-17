import express from 'express';

import {
  getComponents,
  getTimetableFull,
  saveTimetableFull
} from '../controllers/timeTable.controller.js';

import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protect, authorize('HOD'), saveTimetableFull);
router.get('/', protect, authorize('HOD'), getTimetableFull);
router.get('/components', protect, authorize('HOD'), getComponents);

export default router;
