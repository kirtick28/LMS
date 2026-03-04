import express from 'express';
import {
  createCurriculum,
  getAllCurriculums,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum
} from '../controllers/curriculum.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Curriculums
 *   description: Curriculum mappings per department and regulation
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CurriculumSemesterInput:
 *       type: object
 *       required:
 *         - semesterNumber
 *         - subjects
 *       properties:
 *         semesterNumber:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         subjects:
 *           type: array
 *           items:
 *             type: string
 *             description: Subject ObjectId
 *     CurriculumCreateRequest:
 *       type: object
 *       required:
 *         - departmentId
 *         - regulationId
 *       properties:
 *         departmentId:
 *           type: string
 *         regulationId:
 *           type: string
 *         semesters:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CurriculumSemesterInput'
 *         isActive:
 *           type: boolean
 *           example: true
 *     CurriculumUpdateRequest:
 *       type: object
 *       properties:
 *         departmentId:
 *           type: string
 *         regulationId:
 *           type: string
 *         semesters:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CurriculumSemesterInput'
 *         isActive:
 *           type: boolean
 *     CurriculumResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         curriculum:
 *           type: object
 */

/**
 * @swagger
 * /api/curriculums:
 *   post:
 *     summary: Create curriculum
 *     tags: [Curriculums]
 *     description: |
 *       Creates curriculum mapping for a department and regulation.
 *       Validates semester structure, subject ids, and uniqueness of semester numbers.
 *       One curriculum is allowed per department-regulation pair.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CurriculumCreateRequest'
 *     responses:
 *       201:
 *         description: Curriculum created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurriculumResponse'
 *       400:
 *         description: Validation error, invalid ids, missing linked entities, or invalid semesters payload
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       409:
 *         description: Curriculum already exists for department and regulation
 */
router.post('/', protect, authorize('ADMIN'), createCurriculum);

/**
 * @swagger
 * /api/curriculums:
 *   get:
 *     summary: Get all curriculums
 *     tags: [Curriculums]
 *     description: |
 *       Returns curriculum list with populated department, regulation, and subject references.
 *       Optional filters: `departmentId`, `regulationId`, `isActive`.
 *
 *       **Access:** Any authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: regulationId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Curriculum list fetched
 *       400:
 *         description: Invalid query format or bad request
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 */
router.get('/', protect, getAllCurriculums);

/**
 * @swagger
 * /api/curriculums/{id}:
 *   get:
 *     summary: Get curriculum by id
 *     tags: [Curriculums]
 *     description: |
 *       Returns single curriculum with populated nested references.
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
 *         description: Curriculum fetched successfully
 *       400:
 *         description: Invalid curriculum id or bad request
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       404:
 *         description: Curriculum not found
 *       500:
 *         description: Server error
 */
router.get('/:id', protect, getCurriculumById);

/**
 * @swagger
 * /api/curriculums/{id}:
 *   put:
 *     summary: Update curriculum
 *     tags: [Curriculums]
 *     description: |
 *       Updates curriculum fields and validates nested semester/subject payload when provided.
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
 *             $ref: '#/components/schemas/CurriculumUpdateRequest'
 *     responses:
 *       200:
 *         description: Curriculum updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurriculumResponse'
 *       400:
 *         description: Invalid ids, payload validation error, or linked entity missing
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Curriculum not found
 */
router.put('/:id', protect, authorize('ADMIN'), updateCurriculum);

/**
 * @swagger
 * /api/curriculums/{id}:
 *   delete:
 *     summary: Delete curriculum
 *     tags: [Curriculums]
 *     description: |
 *       Deletes curriculum by id.
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
 *         description: Curriculum deleted successfully
 *       400:
 *         description: Invalid curriculum id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Curriculum not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteCurriculum);

export default router;
