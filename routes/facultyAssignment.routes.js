import express from 'express';
import {
  createFacultyAssignment,
  getAllFacultyAssignments,
  getFacultyAssignmentById,
  getAcademicStructure
} from '../controllers/facultyAssignment.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();
router.post('/', protect, authorize('ADMIN', 'HOD'), createFacultyAssignment);
router.get('/', protect, getAllFacultyAssignments);
router.get(
  '/academic-structure',
  protect,
  authorize('HOD'),
  getAcademicStructure
);
router.get('/:id', protect, getFacultyAssignmentById);

export default router;
