import express from 'express';
import {
  createRegulation,
  getAllRegulations,
  getRegulationById,
  updateRegulation,
  deleteRegulation
} from '../controllers/regulation.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Regulations
 *   description: Regulation master data management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RegulationCreateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: R2023
 *         startYear:
 *           type: integer
 *           example: 2023
 *         totalSemesters:
 *           type: integer
 *           minimum: 1
 *           maximum: 8
 *           default: 8
 *           example: 8
 *       description: Either `name` or `startYear` must be supplied. `totalSemesters` is optional and defaults to 8.
 *     RegulationUpdateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         startYear:
 *           type: integer
 *         totalSemesters:
 *           type: integer
 *           minimum: 1
 *           maximum: 8
 *         isActive:
 *           type: boolean
 *     RegulationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             regulation:
 *               type: object
 *     RegulationListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             regulations:
 *               type: array
 *               items:
 *                 type: object
 */

/**
 * @swagger
 * /api/regulations:
 *   post:
 *     summary: Create regulation
 *     tags: [Regulations]
 *     description: |
 *       Creates a regulation. If `name` is omitted and `startYear` is provided,
 *       controller generates name as `R{startYear}`.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegulationCreateRequest'
 *     responses:
 *       201:
 *         description: Regulation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegulationResponse'
 *       400:
 *         description: Missing required values (name or startYear)
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       409:
 *         description: Regulation already exists
 *       500:
 *         description: Server error
 */
router.post('/', protect, authorize('ADMIN'), createRegulation);

/**
 * @swagger
 * /api/regulations:
 *   get:
 *     summary: Get all regulations
 *     tags: [Regulations]
 *     description: |
 *       Returns all regulations sorted by latest start year.
 *
 *       **Access:** Any authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Regulation list fetched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegulationListResponse'
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/', protect, getAllRegulations);

/**
 * @swagger
 * /api/regulations/{id}:
 *   get:
 *     summary: Get regulation by id
 *     tags: [Regulations]
 *     description: |
 *       Returns one regulation by ObjectId.
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
 *         description: Regulation fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegulationResponse'
 *       400:
 *         description: Invalid regulation id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       404:
 *         description: Regulation not found
 *       500:
 *         description: Server error
 */
router.get('/:id', protect, getRegulationById);

/**
 * @swagger
 * /api/regulations/{id}:
 *   put:
 *     summary: Update regulation
 *     tags: [Regulations]
 *     description: |
 *       Updates regulation fields. `name` is normalized to uppercase.
 *       Duplicate checks are applied for `name` and `startYear`.
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
 *             $ref: '#/components/schemas/RegulationUpdateRequest'
 *     responses:
 *       200:
 *         description: Regulation updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegulationResponse'
 *       400:
 *         description: Invalid regulation id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Regulation not found
 *       409:
 *         description: Regulation name or startYear already exists
 *       500:
 *         description: Server error
 */
router.put('/:id', protect, authorize('ADMIN'), updateRegulation);

/**
 * @swagger
 * /api/regulations/{id}:
 *   delete:
 *     summary: Delete regulation
 *     tags: [Regulations]
 *     description: |
 *       Deletes regulation by id.
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
 *         description: Regulation deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegulationResponse'
 *       400:
 *         description: Invalid regulation id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Regulation not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteRegulation);

export default router;
