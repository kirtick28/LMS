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

router.use(protect);

router.patch(
  '/respond',
  authorize('ADMIN', 'FACULTY', 'STUDENT'),
  respondToInvitation
);

router.post(
  '/join/:code',
  authorize('ADMIN', 'FACULTY', 'STUDENT'),
  joinByCode
);

router.post('/invite', authorize('ADMIN', 'FACULTY', 'HOD'), inviteMembers);

router.get(
  '/eligible/:type',
  authorize('ADMIN', 'FACULTY', 'HOD'),
  getEligibleMembersForInvite
);

router.get(
  '/',
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  getClassroomMembers
);

export default router;
