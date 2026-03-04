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
 *         - departmentId
 *         - startYear
 *         - regulationId
 *       properties:
 *         name:
 *           type: string
 *           example: CSE-2023-2027
 *         departmentId:
 *           type: string
 *           description: Department ObjectId
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
 *         regulationId:
 *           type: string
 *           description: Regulation ObjectId
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
 *         regulationId:
 *           type: string
 *         isActive:
 *           type: boolean
 *     BatchResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         batch:
 *           type: object
 *     MessageResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 */

/**
 * @swagger
 * /api/batches:
 *   post:
 *     summary: Create a new batch
 *     tags: [Batches]
 *     description: |
 *       Creates a batch for a department-regulation combination.
 *       If `endYear` is not provided, it is derived from `startYear + programDuration`.
 *       Also ensures an `UNALLOCATED` section exists for the created batch.
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
 *         description: Missing required fields, invalid ids, missing linked entities, or invalid year range
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       409:
 *         description: Batch already exists for department and year range
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
 *       Returns batches with populated department and regulation.
 *       Optional filters are supported.
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
 *         description: Batch list fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Invalid departmentId or regulationId
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
 *       Returns a single batch with populated department and regulation.
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
 *       Updates batch details. If `departmentId`, `startYear`, or `endYear` changes,
 *       uniqueness is re-validated for the department-year combination.
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
 *         description: Invalid ids, missing linked entities, or invalid year range
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Batch not found
 *       409:
 *         description: Duplicate department-year combination
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
