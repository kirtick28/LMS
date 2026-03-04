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
router.post('/', protect, authorize('ADMIN'), createRegulation);
router.get('/', protect, getAllRegulations);
router.get('/:id', protect, getRegulationById);
router.put('/:id', protect, authorize('ADMIN'), updateRegulation);
router.delete('/:id', protect, authorize('ADMIN'), deleteRegulation);

export default router;
