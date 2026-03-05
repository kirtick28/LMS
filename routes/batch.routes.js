import express from 'express';
import {
  createBatch,
  getAllBatches,
  getBatchById,
  updateBatch,
  deleteBatch
} from '../controllers/batch.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Batches
 *   description: Batch master data management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BatchCreateRequest:
 *       type: object
 *       required:
 *         - startYear
 *       properties:
 *         name:
 *           type: string
 *           example: 2023-2027
 *         startYear:
 *           type: integer
 *           example: 2023
 *         endYear:
 *           type: integer
 *           description: Optional; auto-computed using programDuration if omitted
 *           example: 2027
 *         programDuration:
 *           type: integer
 *           example: 4
 *         isActive:
 *           type: boolean
 *           example: true
 *     BatchUpdateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         departmentId:
 *           type: string
 *         startYear:
 *           type: integer
 *         endYear:
 *           type: integer
 *         programDuration:
 *           type: integer
 *         isActive:
 *           type: boolean
 *     BatchResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             batch:
 *               type: object
 *     BatchListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             batches:
 *               type: array
 *               items:
 *                 type: object
 */

/**
 * @swagger
 * /api/batches:
 *   post:
 *     summary: Create a new batch
 *     tags: [Batches]
 *     description: |
 *       Creates a global batch for a year range.
 *       If `endYear` is not provided, it is derived from `startYear + programDuration`.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchCreateRequest'
 *     responses:
 *       201:
 *         description: Batch created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchResponse'
 *       400:
 *         description: Missing required fields or invalid year range
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       409:
 *         description: Batch already exists for the same year range
 *       500:
 *         description: Server error
 */
router.post('/', protect, authorize('ADMIN'), createBatch);

/**
 * @swagger
 * /api/batches:
 *   get:
 *     summary: Get all batches
 *     tags: [Batches]
 *     description: |
 *       Returns batches.
 *       Optional filter: `isActive=true|false`.
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
 *         description: Batch list fetched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchListResponse'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/', protect, getAllBatches);

/**
 * @swagger
 * /api/batches/{id}:
 *   get:
 *     summary: Get batch by id
 *     tags: [Batches]
 *     description: |
 *       Returns a single batch by id.
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
 *         description: Batch fetched successfully
 *       400:
 *         description: Invalid batch id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       404:
 *         description: Batch not found
 *       500:
 *         description: Server error
 */
router.get('/:id', protect, getBatchById);

/**
 * @swagger
 * /api/batches/{id}:
 *   put:
 *     summary: Update batch
 *     tags: [Batches]
 *     description: |
 *       Updates batch details. If year range changes,
 *       uniqueness is re-validated for `startYear` + `endYear`.
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
 *             $ref: '#/components/schemas/BatchUpdateRequest'
 *     responses:
 *       200:
 *         description: Batch updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchResponse'
 *       400:
 *         description: Invalid id or invalid year range
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Batch not found
 *       409:
 *         description: Duplicate year range combination
 *       500:
 *         description: Server error
 */
router.put('/:id', protect, authorize('ADMIN'), updateBatch);

/**
 * @swagger
 * /api/batches/{id}:
 *   delete:
 *     summary: Delete batch
 *     tags: [Batches]
 *     description: |
 *       Deletes the specified batch.
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
 *         description: Batch deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: Invalid batch id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Batch not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteBatch);

export default router;
