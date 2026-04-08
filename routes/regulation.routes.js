import express from 'express';
import {
  createRegulation,
  getAllRegulations,
  getRegulationById,
  updateRegulation,
  deleteRegulation
} from '../controllers/regulation.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('ADMIN'), createRegulation);
router.get('/', getAllRegulations);
router.get('/:id', getRegulationById);
router.put('/:id', authorize('ADMIN'), updateRegulation);
router.delete('/:id', authorize('ADMIN'), deleteRegulation);

export default router;
