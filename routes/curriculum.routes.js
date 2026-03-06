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
 *       additionalProperties: false
 *       description: Semester payload with subject references only (no category field)
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
 *           description: Array of Subject ObjectIds for this semester
 *           items:
 *             type: string
 *             description: Subject ObjectId
 *     CurriculumSemesterResponse:
 *       type: object
 *       properties:
 *         semesterNumber:
 *           type: integer
 *           minimum: 1
 *         subjects:
 *           type: array
 *           description: Populated subjects for this semester
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               courseType:
 *                 type: string
 *               credits:
 *                 type: number
 *     CurriculumCreateRequest:
 *       type: object
 *       additionalProperties: false
 *       description: Create payload for curriculum; semesters include only subjects array and semesterNumber
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
 *       additionalProperties: false
 *       description: Update payload for curriculum; no category field is accepted in semesters
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
 *     CurriculumData:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         departmentId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             code:
 *               type: string
 *         regulationId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             startYear:
 *               type: integer
 *             totalSemesters:
 *               type: integer
 *         semesters:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CurriculumSemesterResponse'
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CurriculumResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             curriculum:
 *               $ref: '#/components/schemas/CurriculumData'
 *     CurriculumListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             curriculums:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CurriculumData'
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
 *       Semesters accept only `semesterNumber` and `subjects` (array of Subject ObjectIds).
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
 *       In each semester, subjects are returned as populated subject objects.
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurriculumListResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurriculumResponse'
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
 *       Semesters support only `subjects` array and do not store category.
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
