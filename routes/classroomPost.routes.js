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
  getPostDetails,
  getPostSubmissions,
  submitPostSubmission,
  addComment,
  deleteComment,
  getTopics
} from '../controllers/classroomPost.controller.js';
import { upload } from '../middlewares/upload.middleware.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

router.get('/', authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'), getClasswork);
router.get(
  '/stream',
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  getStream
);
router.get(
  '/topic',
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  getTopics
);
router.get(
  '/item/:postId',
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  getPostDetails
);
router.get(
  '/item/:postId/submissions',
  authorize('ADMIN', 'FACULTY', 'HOD'),
  getPostSubmissions
);
router.post(
  '/item/:postId/submission',
  upload.array('files', 10),
  authorize('STUDENT'),
  submitPostSubmission
);

// CREATE ops
router.post(
  '/',
  upload.single('file'),
  authorize('ADMIN', 'FACULTY', 'HOD'),
  createPost
);
router.post('/topic', authorize('ADMIN', 'FACULTY', 'HOD'), createTopic);

// COMMENTS
router.post(
  '/:postId/comments',
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  addComment
);
router.delete(
  '/comments/:commentId',
  authorize('ADMIN', 'FACULTY', 'HOD', 'STUDENT'),
  deleteComment
);

// TOPIC management (Static /topic must come before generic /:type)
router.patch(
  '/topic/:topicId',
  authorize('ADMIN', 'FACULTY', 'HOD'),
  updateTopic
);
router.delete(
  '/topic/:topicId',
  authorize('ADMIN', 'FACULTY', 'HOD'),
  deleteTopic
);

// Generic POST management
router.patch(
  '/:type/:postId',
  upload.single('file'),
  authorize('ADMIN', 'FACULTY', 'HOD'),
  updatePost
);
router.delete(
  '/:type/:postId',
  authorize('ADMIN', 'FACULTY', 'HOD'),
  deletePost
);

export default router;
