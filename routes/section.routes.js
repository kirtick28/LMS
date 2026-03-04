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
router.post('/', protect, authorize('ADMIN'), createSection);
router.get('/', protect, getAllSections);
router.get('/:id', protect, getSectionById);
router.put('/:id', protect, authorize('ADMIN'), updateSection);
router.delete('/:id', protect, authorize('ADMIN'), deleteSection);

export default router;
