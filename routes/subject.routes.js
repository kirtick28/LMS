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

router.post('/', protect, authorize('ADMIN'), createSubject);
router.post(
  '/upload/:departmentId/:regulationId',
  protect,
  authorize('ADMIN'),
  upload.single('file'),
  uploadMultipleSubjects
);
router.get('/', protect, getAllSubjects);
router.get('/by-semester', protect, getSubjectsForSemester);
router.get('/:id', protect, getSubjectById);
router.put('/:id', protect, authorize('ADMIN'), updateSubject);
router.delete('/:id', protect, authorize('ADMIN'), deleteSubject);

export default router;
