import express from 'express';
import classroomPostRouter from './classroomPost.routes.js';
import classroomMemberRouter from './classroomMember.routes.js';
import {
  getClassrooms,
  getClassroomById,
  updateClassroom
} from '../controllers/classroom.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// List classrooms
router.get(
  '/',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  getClassrooms
);

// Child Routers (Nested under :classroomId)
router.use('/:classroomId/posts', classroomPostRouter);
router.use('/:classroomId/members', classroomMemberRouter);

// Specific Classroom Actions
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
