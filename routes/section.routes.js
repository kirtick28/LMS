import express from 'express';
import {
  createSection,
  getAllSections,
  getSectionById,
  updateSection,
  deleteSection
} from '../controllers/section.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Sections
 *   description: Section master data management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SectionCreateRequest:
 *       type: object
 *       required:
 *         - name
 *         - batchProgramId
 *       properties:
 *         name:
 *           type: string
 *           example: A
 *         batchProgramId:
 *           type: string
 *         capacity:
 *           type: integer
 *           example: 60
 *         isActive:
 *           type: boolean
 *           example: true
 *     SectionUpdateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         batchProgramId:
 *           type: string
 *         capacity:
 *           type: integer
 *         isActive:
 *           type: boolean
 *     SectionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             section:
 *               type: object
 */

/**
 * @swagger
 * /api/sections:
 *   post:
 *     summary: Create section
 *     tags: [Sections]
 *     description: |
 *       Creates a section under a BatchProgram. Section name is normalized to uppercase.
 *       Section uniqueness is enforced per BatchProgram.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SectionCreateRequest'
 *     responses:
 *       201:
 *         description: Section created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SectionResponse'
 *       400:
 *         description: Missing required fields or invalid batchProgramId
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       409:
 *         description: Section already exists for this BatchProgram
 *       500:
 *         description: Server error
 */
router.post('/', protect, authorize('ADMIN'), createSection);

/**
 * @swagger
 * /api/sections:
 *   get:
 *     summary: Get all sections
 *     tags: [Sections]
 *     description: |
 *       Returns sections with nested BatchProgram, batch, department, and regulation details.
 *       Optional filters: `batchProgramId`, `isActive`.
 *
 *       **Access:** Any authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: batchProgramId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Section list fetched
 *       400:
 *         description: Invalid batchProgramId
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/', protect, getAllSections);

/**
 * @swagger
 * /api/sections/{id}:
 *   get:
 *     summary: Get section by id
 *     tags: [Sections]
 *     description: |
 *       Returns a section with nested BatchProgram context.
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
 *         description: Section fetched successfully
 *       400:
 *         description: Invalid section id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get('/:id', protect, getSectionById);

/**
 * @swagger
 * /api/sections/{id}:
 *   put:
 *     summary: Update section
 *     tags: [Sections]
 *     description: |
 *       Updates section fields. If `name` or `batchProgramId` changes,
 *       duplicate section check is re-run within target BatchProgram.
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
 *             $ref: '#/components/schemas/SectionUpdateRequest'
 *     responses:
 *       200:
 *         description: Section updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SectionResponse'
 *       400:
 *         description: Invalid ids or missing batch
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Section not found
 *       409:
 *         description: Section already exists in target batch
 *       500:
 *         description: Server error
 */
router.put('/:id', protect, authorize('ADMIN'), updateSection);

/**
 * @swagger
 * /api/sections/{id}:
 *   delete:
 *     summary: Delete section
 *     tags: [Sections]
 *     description: |
 *       Deletes the selected section.
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
 *         description: Section deleted successfully
 *       400:
 *         description: Invalid section id
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteSection);

export default router;
