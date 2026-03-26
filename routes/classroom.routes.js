import express from 'express';
import {
  getClassrooms,
  getClassroomById,
  updateClassroom
} from '../controllers/classroom.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  getClassrooms
);
router.get(
  '/:id',
  protect,
  authorize('ADMIN', 'FACULTY', 'STUDENT', 'HOD'),
  getClassroomById
);
router.get(
  '/:id',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD'),
  updateClassroom
);

export default router;
