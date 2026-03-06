import express from 'express';
import {
  createBatchProgram,
  getAllBatchPrograms,
  getBatchProgramDetailsByParams,
  getBatchProgramById,
  updateBatchProgram,
  deleteBatchProgram
} from '../controllers/batchProgram.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: BatchPrograms
 *   description: Mapping between batch, department and regulation
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BatchProgramCreateRequest:
 *       type: object
 *       required:
 *         - batchId
 *         - departmentId
 *         - regulationId
 *       properties:
 *         batchId:
 *           type: string
 *         departmentId:
 *           type: string
 *         regulationId:
 *           type: string
 *     BatchProgramUpdateRequest:
 *       type: object
 *       properties:
 *         batchId:
 *           type: string
 *         departmentId:
 *           type: string
 *         regulationId:
 *           type: string
 *     BatchProgramResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             batchProgram:
 *               type: object
 *     BatchProgramListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             batchPrograms:
 *               type: array
 *               items:
 *                 type: object
 */

/**
 * @swagger
 * /api/batch-programs:
 *   post:
 *     summary: Create batch-program mapping
 *     tags: [BatchPrograms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchProgramCreateRequest'
 *     responses:
 *       201:
 *         description: BatchProgram created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchProgramResponse'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Referenced entities not found
 *       409:
 *         description: Duplicate mapping
 */
router.post('/', protect, authorize('ADMIN'), createBatchProgram);

/**
 * @swagger
 * /api/batch-programs:
 *   get:
 *     summary: Get all batch-program mappings
 *     tags: [BatchPrograms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: regulationId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: BatchPrograms fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchProgramListResponse'
 *       400:
 *         description: Invalid query id
 *       401:
 *         description: Unauthorized
 */
router.get('/', protect, getAllBatchPrograms);

/**
 * @swagger
 * /api/batch-programs/{batchId}/{departmentId}:
 *   get:
 *     summary: Get batch-program id and batch details by batch and department
 *     tags: [BatchPrograms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: BatchProgram id and batch details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     batchProgramId:
 *                       type: string
 *                     batch:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         startYear:
 *                           type: integer
 *                         endYear:
 *                           type: integer
 *       400:
 *         description: Missing or invalid path ids
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: BatchProgram not found
 */
router.get('/:batchId/:departmentId', protect, getBatchProgramDetailsByParams);

/**
 * @swagger
 * /api/batch-programs/{id}:
 *   get:
 *     summary: Get batch-program mapping by id
 *     tags: [BatchPrograms]
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
 *         description: BatchProgram fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchProgramResponse'
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.get('/:id', protect, getBatchProgramById);

/**
 * @swagger
 * /api/batch-programs/{id}:
 *   put:
 *     summary: Update batch-program mapping
 *     tags: [BatchPrograms]
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
 *             $ref: '#/components/schemas/BatchProgramUpdateRequest'
 *     responses:
 *       200:
 *         description: BatchProgram updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchProgramResponse'
 *       400:
 *         description: Invalid id or payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Not found
 *       409:
 *         description: Duplicate mapping
 */
router.put('/:id', protect, authorize('ADMIN'), updateBatchProgram);

/**
 * @swagger
 * /api/batch-programs/{id}:
 *   delete:
 *     summary: Delete batch-program mapping
 *     tags: [BatchPrograms]
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
 *         description: BatchProgram deleted successfully
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Not found
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteBatchProgram);

export default router;
