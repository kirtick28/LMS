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

/**
 * @swagger
 * tags:
 *   name: Departments
 *   description: Department master data management
 */

/**
 * @swagger
 * /api/departments:
 *   post:
 *     summary: Create department
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', protect, authorize('ADMIN'), createDepartment);

/**
 * @swagger
 * /api/departments:
 *   get:
 *     summary: List departments
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', protect, getAllDepartments);

/**
 * @swagger
 * /api/departments/{id}:
 *   get:
 *     summary: Get department by id
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', protect, getDepartmentById);

/**
 * @swagger
 * /api/departments/{id}:
 *   put:
 *     summary: Update department
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', protect, authorize('ADMIN'), updateDepartment);

/**
 * @swagger
 * /api/departments/{id}:
 *   delete:
 *     summary: Delete department
 *     tags: [Departments]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteDepartment);

export default router;
