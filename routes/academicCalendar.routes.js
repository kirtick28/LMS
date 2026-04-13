import express from 'express';
import {
  getAllEntries,
  createEntry,
  bulkCreateEntries,
  getEntryByDate,
  updateEntry,
  deleteEntry
} from '../controllers/academicCalendar.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getAllEntries).post(authorize('ADMIN'), createEntry);
router.route('/bulk').post(authorize('ADMIN'), bulkCreateEntries);
router.route('/date/:dateString').get(getEntryByDate);
router
  .route('/:id')
  .patch(authorize('ADMIN'), updateEntry)
  .delete(authorize('ADMIN'), deleteEntry);

export default router;
