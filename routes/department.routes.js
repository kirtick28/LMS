import express from 'express';
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment
} from '../controllers/department.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protect, authorize('ADMIN'), createDepartment);
router.get('/', protect, getAllDepartments);
router.get('/:id', protect, getDepartmentById);
router.put('/:id', protect, authorize('ADMIN'), updateDepartment);
router.delete('/:id', protect, authorize('ADMIN'), deleteDepartment);

export default router;
