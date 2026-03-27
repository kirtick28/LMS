import express from 'express';
import classroomPostRouter from './classroomPost.routes.js';
import {
  getClassrooms,
  getClassroomById,
  updateClassroom
} from '../controllers/classroom.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use('/:classroomId/posts', classroomPostRouter);

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
router.put(
  '/:id',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD'),
  updateClassroom
);

export default router;
