import express from 'express';
import {
  createFacultyAssignment,
  getAllFacultyAssignments,
  getFacultyAssignmentById,
  updateFacultyAssignment,
  deleteFacultyAssignment
} from '../controllers/facultyAssignment.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: FacultyAssignments
 *   description: Faculty allocation to section-subject-academic year
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     FacultyAssignmentCreateRequest:
 *       type: object
 *       required:
 *         - facultyId
 *         - sectionId
 *         - subjectId
 *         - academicYearId
 *         - semesterNumber
 *       properties:
 *         facultyId:
 *           type: string
 *         sectionId:
 *           type: string
 *         subjectId:
 *           type: string
 *         academicYearId:
 *           type: string
 *         semesterNumber:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *     FacultyAssignmentUpdateRequest:
 *       type: object
 *       properties:
 *         facultyId:
 *           type: string
 *         sectionId:
 *           type: string
 *         subjectId:
 *           type: string
 *         academicYearId:
 *           type: string
 *         semesterNumber:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *     FacultyAssignmentResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             assignment:
 *               type: object
 *     FacultyAssignmentListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             assignments:
 *               type: array
 *               items:
 *                 type: object
 */

/**
 * @swagger
 * /api/faculty-assignments:
 *   post:
 *     summary: Create faculty assignment
 *     tags: [FacultyAssignments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FacultyAssignmentCreateRequest'
 *     responses:
 *       201:
 *         description: Faculty assignment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyAssignmentResponse'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Referenced entities not found
 *       409:
 *         description: Duplicate active assignment
 */
router.post('/', protect, authorize('ADMIN'), createFacultyAssignment);

/**
 * @swagger
 * /api/faculty-assignments:
 *   get:
 *     summary: Get all faculty assignments
 *     tags: [FacultyAssignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: facultyId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sectionId
 *         schema:
 *           type: string
 *       - in: query
 *         name: academicYearId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Faculty assignments fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyAssignmentListResponse'
 *       400:
 *         description: Invalid query id
 *       401:
 *         description: Unauthorized
 */
router.get('/', protect, getAllFacultyAssignments);

/**
 * @swagger
 * /api/faculty-assignments/{id}:
 *   get:
 *     summary: Get faculty assignment by id
 *     tags: [FacultyAssignments]
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
 *         description: Faculty assignment fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyAssignmentResponse'
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.get('/:id', protect, getFacultyAssignmentById);

/**
 * @swagger
 * /api/faculty-assignments/{id}:
 *   put:
 *     summary: Update faculty assignment
 *     tags: [FacultyAssignments]
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
 *             $ref: '#/components/schemas/FacultyAssignmentUpdateRequest'
 *     responses:
 *       200:
 *         description: Faculty assignment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyAssignmentResponse'
 *       400:
 *         description: Invalid id or payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Not found
 *       409:
 *         description: Duplicate active assignment
 */
router.put('/:id', protect, authorize('ADMIN'), updateFacultyAssignment);

/**
 * @swagger
 * /api/faculty-assignments/{id}:
 *   delete:
 *     summary: Delete faculty assignment
 *     tags: [FacultyAssignments]
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
 *         description: Faculty assignment deleted successfully
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Not found
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteFacultyAssignment);

export default router;
