import express from 'express';
import multer from 'multer';
import {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  uploadMultipleSubjects,
  getSubjectsForSemester
} from '../controllers/subject.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.post('/', authorize('ADMIN'), createSubject);
router.post(
  '/upload/:departmentId/:regulationId',
  authorize('ADMIN'),
  upload.single('file'),
  uploadMultipleSubjects
);
router.get('/', getAllSubjects);
router.get('/by-semester', getSubjectsForSemester);
router.get('/:id', getSubjectById);
router.put('/:id', authorize('ADMIN'), updateSubject);
router.delete('/:id', authorize('ADMIN'), deleteSubject);

export default router;
