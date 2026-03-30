import express from 'express';
import {
  getClassroomMembers,
  getEligibleMembersForInvite,
  inviteMembers,
  joinByCode,
  respondToInvitation
} from '../controllers/classroomMember.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.patch(
  '/respond',
  protect,
  authorize('ADMIN', 'FACULTY', 'STUDENT'),
  respondToInvitation
);

router.post(
  '/join/:code',
  protect,
  authorize('ADMIN', 'FACULTY', 'STUDENT'),
  joinByCode
);

router.post(
  '/invite',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD'),
  inviteMembers
);

router.get(
  '/eligible/:type',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD'),
  getEligibleMembersForInvite
);

router.get(
  '/',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  getClassroomMembers
);

export default router;
