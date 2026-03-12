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
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   name: Subjects
 *   description: Subject master data management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SubjectCreateRequest:
 *       type: object
 *       required:
 *         - name
 *         - code
 *         - departmentId
 *         - regulationId
 *       properties:
 *         name:
 *           type: string
 *           example: Engineering Mathematics
 *         code:
 *           type: string
 *           example: MA3151
 *         credits:
 *           type: number
 *           example: 4
 *         courseType:
 *           type: string
 *           enum: [T, P, TP, TPJ, PJ, I]
 *           example: T
 *         departmentId:
 *           type: string
 *           description: Department ObjectId
 *         regulationId:
 *           type: string
 *           description: Regulation ObjectId
 *         isActive:
 *           type: boolean
 *           example: true
 *
 *     SubjectUpdateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         credits:
 *           type: number
 *         courseType:
 *           type: string
 *           enum: [T, P, TP, TPJ, PJ, I]
 *         departmentId:
 *           type: string
 *         regulationId:
 *           type: string
 *         isActive:
 *           type: boolean
 *
 *     SubjectResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             subject:
 *               type: object
 *
 *     SubjectListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             subjects:
 *               type: array
 *               items:
 *                 type: object
 *
 *     SubjectUploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             inserted:
 *               type: integer
 *             skipped:
 *               type: integer
 *             failed:
 *               type: integer
 */

/**
 * @swagger
 * /api/subjects:
 *   post:
 *     summary: Create subject
 *     tags: [Subjects]
 *     description: |
 *       Creates a subject and links it to both department and regulation.
 *       Code is normalized to uppercase and duplicate checks are applied
 *       per department + regulation.
 *
 *       **Access:** ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubjectCreateRequest'
 *     responses:
 *       201:
 *         description: Subject created successfully
 *       400:
 *         description: Missing fields or invalid ids
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: ADMIN access required
 *       409:
 *         description: Duplicate subject in same regulation
 */
router.post('/', protect, authorize('ADMIN'), createSubject);

/**
 * @swagger
 * /api/subjects/upload:
 *   post:
 *     summary: Bulk upload subjects from Excel
 *     tags: [Subjects]
 *     description: |
 *       Upload `.xlsx` file.
 *
 *       Required Excel columns:
 *
 *       name | code | credits | courseType | startYear
 *
 *       `startYear` maps the subject to a Regulation.
 *
 *       `departmentId` must be provided in body or URL.
 *
 *       **Access:** ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               departmentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Upload completed
 */
router.post(
  '/upload',
  protect,
  authorize('ADMIN'),
  upload.single('file'),
  uploadMultipleSubjects
);

/**
 * @swagger
 * /api/subjects/upload/{departmentId}:
 *   post:
 *     summary: Bulk upload subjects using department path param
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload completed
 */
router.post(
  '/upload/:departmentId',
  protect,
  authorize('ADMIN'),
  upload.single('file'),
  uploadMultipleSubjects
);

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: Get all subjects
 *     tags: [Subjects]
 *     description: |
 *       Returns subjects with department and regulation populated.
 *
 *       Filters supported:
 *       - departmentId
 *       - regulationId
 *       - courseType
 *       - isActive
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
 *         name: courseType
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 */
router.get('/', protect, getAllSubjects);

/**
 * @swagger
 * /api/subjects/by-semester:
 *   get:
 *     summary: Get subjects for a specific semester
 *     tags: [Subjects]
 *     description: |
 *       Returns a list of subjects for a given department, regulation, and semester.
 *
 *       **Access:** Any authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         required: true
 *         description: Department ObjectId
 *       - in: query
 *         name: regulationId
 *         schema:
 *           type: string
 *         required: true
 *         description: Regulation ObjectId
 *       - in: query
 *         name: semester
 *         schema:
 *           type: integer
 *         required: true
 *         description: Semester number (e.g., 1, 2, 3, ...)
 *     responses:
 *       200:
 *         description: List of subjects for the semester
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubjectListResponse'
 *       400:
 *         description: Missing or invalid parameters
 *       401:
 *         description: Unauthorized
 */
router.get('/by-semester', protect, getSubjectsForSemester);

/**
 * @swagger
 * /api/subjects/{id}:
 *   get:
 *     summary: Get subject by id
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', protect, getSubjectById);

/**
 * @swagger
 * /api/subjects/{id}:
 *   put:
 *     summary: Update subject
 *     tags: [Subjects]
 *     description: |
 *       Updates subject details including department or regulation.
 *
 *       Duplicate checks are enforced per department + regulation.
 *
 *       **Access:** ADMIN only
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', protect, authorize('ADMIN'), updateSubject);

/**
 * @swagger
 * /api/subjects/{id}:
 *   delete:
 *     summary: Delete subject
 *     tags: [Subjects]
 *     description: |
 *       Deletes a subject.
 *
 *       **Access:** ADMIN only
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteSubject);

export default router;
