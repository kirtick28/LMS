import express from 'express';
import multer from 'multer';
import {
  addFaculty,
  updateFaculty,
  deleteFaculty,
  uploadMultipleFaculty,
  getAllFaculty,
  getDepartmentWise,
  getDepartmentWiseFaculty,
  getDepartmentWiseFacultyList,
  getDashboardStats,
  getMyInfo
} from '../controllers/faculty.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', protect, authorize('ADMIN'), addFaculty);
router.get('/me', protect, authorize('FACULTY', 'ADMIN', 'HOD'), getMyInfo);
router.post(
  '/upload',
  protect,
  authorize('ADMIN'),
  upload.single('file'),
  uploadMultipleFaculty
);
router.put(
  '/:id',
  protect,
  authorize('ADMIN'),
  upload.fields([
    { name: 'marksheet', maxCount: 1 },
    { name: 'experienceCertificate', maxCount: 1 },
    { name: 'degreeCertificate', maxCount: 1 }
  ]),
  updateFaculty
);
router.delete('/:id', protect, authorize('ADMIN'), deleteFaculty);
router.get('/', protect, authorize('FACULTY', 'ADMIN', 'HOD'), getAllFaculty);
router.get(
  '/department-wise',
  protect,
  authorize('FACULTY', 'ADMIN'),
  getDepartmentWise
);
router.get(
  '/department-wise/:department',
  protect,
  authorize('FACULTY', 'ADMIN'),
  getDepartmentWiseFaculty
);
router.get(
  '/department-wise/:department/list',
  protect,
  authorize('FACULTY', 'ADMIN'),
  getDepartmentWiseFacultyList
);
router.get(
  '/dashboard/stats',
  protect,
  authorize('FACULTY', 'ADMIN'),
  getDashboardStats
);

export default router;
