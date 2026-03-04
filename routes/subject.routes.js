import express from 'express';
import multer from 'multer';
import {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  uploadMultipleSubjects
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
 *           enum: [T, P, TP, PJ, I]
 *           example: T
 *         departmentId:
 *           type: string
 *           description: Department ObjectId
 *         isActive:
 *           type: boolean
 *           example: true
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
 *           enum: [T, P, TP, PJ, I]
 *         departmentId:
 *           type: string
 *         isActive:
 *           type: boolean
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
 *       Creates a subject and links it to a department.
 *       Code is normalized to uppercase and duplicate checks are applied.
 *
 *       **Access:** Authenticated users with role ADMIN only
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubjectResponse'
 *       400:
 *         description: Missing required fields, invalid departmentId, or department not found
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       409:
 *         description: Subject with duplicate code or duplicate name in same department
 *       500:
 *         description: Server error
 */
router.post('/', protect, authorize('ADMIN'), createSubject);

/**
 * @swagger
 * /api/subjects/upload:
 *   post:
 *     summary: Bulk upload subjects from Excel
 *     tags: [Subjects]
 *     description: |
 *       Upload `.xlsx` file with `file` field.
 *       Expected columns per row: `name`, `code` and optional `credits`, `courseType`.
 *       `departmentId` must be provided either as multipart field or path param.
 *       Controller returns inserted/skipped/failed counts.
 *
 *       **Access:** Authenticated users with role ADMIN only
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
 *                 description: Department ObjectId (required if not provided in path)
 *     responses:
 *       200:
 *         description: Upload completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubjectUploadResponse'
 *       400:
 *         description: No file uploaded
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       500:
 *         description: Server error
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
 *     summary: Bulk upload subjects from Excel using department path param
 *     tags: [Subjects]
 *     description: |
 *       Upload `.xlsx` file with `file` field and pass department id in URL.
 *       Expected columns per row: `name`, `code` and optional `credits`, `courseType`.
 *
 *       **Access:** Authenticated users with role ADMIN only
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
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubjectUploadResponse'
 *       400:
 *         description: Missing file, invalid departmentId, or department not found
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       500:
 *         description: Server error
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
 *       Returns subject list with populated department details.
 *       Optional filters: `departmentId`, `courseType`, `isActive`.
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
 *         name: courseType
 *         schema:
 *           type: string
 *           enum: [T, P, TP, PJ, I]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Subject list fetched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubjectListResponse'
 *       400:
 *         description: Invalid departmentId
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/', protect, getAllSubjects);

/**
 * @swagger
 * /api/subjects/{id}:
 *   get:
 *     summary: Get subject by id
 *     tags: [Subjects]
 *     description: |
 *       Returns one subject with populated department details.
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
 *         description: Subject fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubjectResponse'
 *       400:
 *         description: Invalid subject id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       404:
 *         description: Subject not found
 *       500:
 *         description: Server error
 */
router.get('/:id', protect, getSubjectById);

/**
 * @swagger
 * /api/subjects/{id}:
 *   put:
 *     summary: Update subject
 *     tags: [Subjects]
 *     description: |
 *       Updates subject details and re-validates duplicates.
 *       If `departmentId` is changed, the department is validated.
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
 *             $ref: '#/components/schemas/SubjectUpdateRequest'
 *     responses:
 *       200:
 *         description: Subject updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubjectResponse'
 *       400:
 *         description: Invalid subject id or departmentId, or department not found
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Subject not found
 *       409:
 *         description: Subject with duplicate code or duplicate name in same department
 *       500:
 *         description: Server error
 */
router.put('/:id', protect, authorize('ADMIN'), updateSubject);

/**
 * @swagger
 * /api/subjects/{id}:
 *   delete:
 *     summary: Delete subject
 *     tags: [Subjects]
 *     description: |
 *       Deletes a subject by id.
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
 *         description: Subject deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubjectResponse'
 *       400:
 *         description: Invalid subject id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Subject not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteSubject);

export default router;
