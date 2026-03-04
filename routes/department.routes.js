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
 * components:
 *   schemas:
 *     DepartmentCreateRequest:
 *       type: object
 *       required:
 *         - name
 *         - code
 *       properties:
 *         name:
 *           type: string
 *           example: Computer Science and Engineering
 *         code:
 *           type: string
 *           example: CSE
 *         program:
 *           type: string
 *           example: B.E
 *         hodId:
 *           type: string
 *           description: Faculty ObjectId
 *         isActive:
 *           type: boolean
 *           example: true
 *     DepartmentUpdateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         program:
 *           type: string
 *         hodId:
 *           type: string
 *         isActive:
 *           type: boolean
 *     DepartmentResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             department:
 *               type: object
 *     DepartmentListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             departments:
 *               type: array
 *               items:
 *                 type: object
 */

/**
 * @swagger
 * /api/departments:
 *   post:
 *     summary: Create department
 *     tags: [Departments]
 *     description: |
 *       Creates a new department after validating unique `name` and `code`.
 *       `code` is normalized to uppercase in controller.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DepartmentCreateRequest'
 *     responses:
 *       201:
 *         description: Department created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentResponse'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       409:
 *         description: Department with same name or code already exists
 *       500:
 *         description: Server error
 */
router.post('/', protect, authorize('ADMIN'), createDepartment);

/**
 * @swagger
 * /api/departments:
 *   get:
 *     summary: List departments
 *     tags: [Departments]
 *     description: |
 *       Returns department list with populated HOD details.
 *       Optional query: `isActive=true|false`.
 *
 *       **Access:** Any authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Department list fetched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentListResponse'
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/', protect, getAllDepartments);

/**
 * @swagger
 * /api/departments/{id}:
 *   get:
 *     summary: Get department by id
 *     tags: [Departments]
 *     description: |
 *       Returns one department by ObjectId with populated HOD details.
 *
 *       **Access:** Any authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentResponse'
 *       400:
 *         description: Invalid department id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server error
 */
router.get('/:id', protect, getDepartmentById);

/**
 * @swagger
 * /api/departments/{id}:
 *   put:
 *     summary: Update department
 *     tags: [Departments]
 *     description: |
 *       Updates department fields. If `name`/`code` changes,
 *       uniqueness checks are enforced.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DepartmentUpdateRequest'
 *     responses:
 *       200:
 *         description: Department updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentResponse'
 *       400:
 *         description: Invalid department id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Department not found
 *       409:
 *         description: Department name or code already exists
 *       500:
 *         description: Server error
 */
router.put('/:id', protect, authorize('ADMIN'), updateDepartment);

/**
 * @swagger
 * /api/departments/{id}:
 *   delete:
 *     summary: Delete department
 *     tags: [Departments]
 *     description: |
 *       Deletes department by id.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentResponse'
 *       400:
 *         description: Invalid department id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteDepartment);

export default router;
