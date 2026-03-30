import express from 'express';
import {
  createTopic,
  updateTopic,
  deleteTopic,
  createPost,
  updatePost,
  deletePost,
  getStream,
  getClasswork,
  addComment,
  deleteComment,
  getTopics
} from '../controllers/classroomPost.controller.js';
import { upload } from '../middlewares/upload.middleware.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// READ ops
router.get(
  '/',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  getClasswork
);
router.get(
  '/stream',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  getStream
);
router.get(
  '/topic',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  getTopics
);

// CREATE ops
router.post(
  '/',
  upload.single('file'),
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD'),
  createPost
);
router.post(
  '/topic',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD'),
  createTopic
);

// COMMENTS
router.post(
  '/:postId/comments',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  addComment
);
router.delete(
  '/comments/:commentId',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  deleteComment
);

// TOPIC management (Static /topic must come before generic /:type)
router.patch(
  '/topic/:topicId',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD'),
  updateTopic
);
router.delete(
  '/topic/:topicId',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD'),
  deleteTopic
);

// Generic POST management
router.patch(
  '/:type/:postId',
  upload.single('file'),
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD'),
  updatePost
);
router.delete(
  '/:type/:postId',
  protect,
  authorize('ADMIN', 'FACULTY', 'HOD'),
  deletePost
);

export default router;
