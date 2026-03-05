import express from 'express';
import {
  createAcademicYear,
  getAllAcademicYears,
  getAcademicYearById,
  updateAcademicYear,
  deleteAcademicYear
} from '../controllers/academicYear.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AcademicYears
 *   description: Academic year master data management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AcademicYearCreateRequest:
 *       type: object
 *       required:
 *         - startYear
 *         - endYear
 *         - startDate
 *         - endDate
 *       properties:
 *         startYear:
 *           type: integer
 *           example: 2025
 *         endYear:
 *           type: integer
 *           example: 2026
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         isActive:
 *           type: boolean
 *           example: true
 *     AcademicYearUpdateRequest:
 *       type: object
 *       properties:
 *         startYear:
 *           type: integer
 *         endYear:
 *           type: integer
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         isActive:
 *           type: boolean
 *     AcademicYearResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             academicYear:
 *               type: object
 *     AcademicYearListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             academicYears:
 *               type: array
 *               items:
 *                 type: object
 */

/**
 * @swagger
 * /api/academic-years:
 *   post:
 *     summary: Create academic year
 *     tags: [AcademicYears]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AcademicYearCreateRequest'
 *     responses:
 *       201:
 *         description: Academic year created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AcademicYearResponse'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       409:
 *         description: Academic year already exists
 */
router.post('/', protect, authorize('ADMIN'), createAcademicYear);

/**
 * @swagger
 * /api/academic-years:
 *   get:
 *     summary: Get all academic years
 *     tags: [AcademicYears]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Academic years fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AcademicYearListResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/', protect, getAllAcademicYears);

/**
 * @swagger
 * /api/academic-years/{id}:
 *   get:
 *     summary: Get academic year by id
 *     tags: [AcademicYears]
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
 *         description: Academic year fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AcademicYearResponse'
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.get('/:id', protect, getAcademicYearById);

/**
 * @swagger
 * /api/academic-years/{id}:
 *   put:
 *     summary: Update academic year
 *     tags: [AcademicYears]
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
 *             $ref: '#/components/schemas/AcademicYearUpdateRequest'
 *     responses:
 *       200:
 *         description: Academic year updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AcademicYearResponse'
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Not found
 */
router.put('/:id', protect, authorize('ADMIN'), updateAcademicYear);

/**
 * @swagger
 * /api/academic-years/{id}:
 *   delete:
 *     summary: Delete academic year
 *     tags: [AcademicYears]
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
 *         description: Academic year deleted successfully
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Not found
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteAcademicYear);

export default router;
