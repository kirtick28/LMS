import express from 'express';

import {
  getComponents,
  getTimetableFull,
  saveTimetableFull
} from '../controllers/timeTable.controller.js';

import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router
  .route('/')
  .post(protect, authorize('HOD'), saveTimetableFull)
  .get(protect, authorize('HOD'), getTimetableFull);

router.route('/components').get(protect, authorize('HOD'), getComponents);

export default router;
