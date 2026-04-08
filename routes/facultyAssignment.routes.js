import express from 'express';
import {
  manageFacultyAssignments,
  getAllFacultyAssignments,
  getFacultyAssignmentById,
  getAcademicStructure
} from '../controllers/facultyAssignment.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('ADMIN', 'HOD'), manageFacultyAssignments);
router.get('/', getAllFacultyAssignments);
router.get(
  '/academic-structure/:departmentId',
  authorize('HOD', 'ADMIN'),
  getAcademicStructure
);
router.get('/:id', getFacultyAssignmentById);

export default router;
