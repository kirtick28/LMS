import express from 'express';
import {
  getCoursePlan,
  upsertCoursePlan
} from '../controllers/coursePlan.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCoursePlan);
router.post('/', authorize('FACULTY', 'ADMIN'), upsertCoursePlan);

export default router;
