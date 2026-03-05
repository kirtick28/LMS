import express from 'express';
import {
  createStudentAcademicRecord,
  getAllStudentAcademicRecords,
  getStudentAcademicRecordById,
  updateStudentAcademicRecord,
  deleteStudentAcademicRecord
} from '../controllers/studentAcademicRecord.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: StudentAcademicRecords
 *   description: Student semester-wise record by academic year
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     StudentAcademicRecordCreateRequest:
 *       type: object
 *       required:
 *         - studentId
 *         - academicYearId
 *         - semesterNumber
 *         - sectionId
 *       properties:
 *         studentId:
 *           type: string
 *         academicYearId:
 *           type: string
 *         semesterNumber:
 *           type: integer
 *         sectionId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, inactive, passed_out]
 *     StudentAcademicRecordUpdateRequest:
 *       type: object
 *       properties:
 *         studentId:
 *           type: string
 *         academicYearId:
 *           type: string
 *         semesterNumber:
 *           type: integer
 *         sectionId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, inactive, passed_out]
 *     StudentAcademicRecordResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             record:
 *               type: object
 *     StudentAcademicRecordListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             records:
 *               type: array
 *               items:
 *                 type: object
 */

/**
 * @swagger
 * /api/student-academic-records:
 *   post:
 *     summary: Create student academic record
 *     tags: [StudentAcademicRecords]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudentAcademicRecordCreateRequest'
 *     responses:
 *       201:
 *         description: Student academic record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentAcademicRecordResponse'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Referenced entities not found
 *       409:
 *         description: Duplicate record
 */
router.post('/', protect, authorize('ADMIN'), createStudentAcademicRecord);

/**
 * @swagger
 * /api/student-academic-records:
 *   get:
 *     summary: Get all student academic records
 *     tags: [StudentAcademicRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: academicYearId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sectionId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student academic records fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentAcademicRecordListResponse'
 *       400:
 *         description: Invalid query id
 *       401:
 *         description: Unauthorized
 */
router.get('/', protect, getAllStudentAcademicRecords);

/**
 * @swagger
 * /api/student-academic-records/{id}:
 *   get:
 *     summary: Get student academic record by id
 *     tags: [StudentAcademicRecords]
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
 *         description: Student academic record fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentAcademicRecordResponse'
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.get('/:id', protect, getStudentAcademicRecordById);

/**
 * @swagger
 * /api/student-academic-records/{id}:
 *   put:
 *     summary: Update student academic record
 *     tags: [StudentAcademicRecords]
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
 *             $ref: '#/components/schemas/StudentAcademicRecordUpdateRequest'
 *     responses:
 *       200:
 *         description: Student academic record updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentAcademicRecordResponse'
 *       400:
 *         description: Invalid id or payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Not found
 *       409:
 *         description: Duplicate record
 */
router.put('/:id', protect, authorize('ADMIN'), updateStudentAcademicRecord);

/**
 * @swagger
 * /api/student-academic-records/{id}:
 *   delete:
 *     summary: Delete student academic record
 *     tags: [StudentAcademicRecords]
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
 *         description: Student academic record deleted successfully
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Not found
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteStudentAcademicRecord);

export default router;
