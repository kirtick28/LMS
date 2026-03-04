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
  getDashboardStats
} from '../controllers/faculty.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   name: Faculty
 *   description: Faculty profile management, bulk import, and analytics
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     FacultyCreateRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *         - employeeId
 *         - mobileNumber
 *         - designation
 *       properties:
 *         email:
 *           type: string
 *           example: faculty1@example.com
 *         password:
 *           type: string
 *           example: pass1234
 *         firstName:
 *           type: string
 *           example: Ravi
 *         lastName:
 *           type: string
 *           example: Kumar
 *         salutation:
 *           type: string
 *           example: Dr.
 *         mobileNumber:
 *           type: string
 *           example: 9876543210
 *         phone:
 *           type: string
 *           description: Alias for mobileNumber
 *           example: 9876543210
 *         employeeId:
 *           type: string
 *           example: EMP1001
 *         designation:
 *           type: string
 *           enum: [Professor, Assistant Professor, Associate Professor, HOD, Dean, Faculty, Professor of Practice, Lab Technician, Department Secretary, Senior Lab Technician]
 *         departmentId:
 *           type: string
 *           description: Existing department ObjectId
 *         departmentName:
 *           type: string
 *           description: Used to find/create department if departmentId is not supplied
 *           example: Computer Science and Engineering
 *         departmentCode:
 *           type: string
 *           example: CSE
 *         qualification:
 *           type: string
 *           example: PhD
 *         workType:
 *           type: string
 *           example: Full Time
 *         joiningDate:
 *           type: string
 *           format: date
 *           example: 2024-06-15
 *         reportingManager:
 *           type: string
 *           description: Faculty ObjectId
 *         noticePeriod:
 *           type: string
 *           example: 2 months
 *         gender:
 *           type: string
 *           enum: [Male, Female, Other]
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           example: 1986-01-21
 *     FacultyUpdateRequest:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *         password:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         mobileNumber:
 *           type: string
 *         phone:
 *           type: string
 *         employeeId:
 *           type: string
 *         designation:
 *           type: string
 *         departmentId:
 *           type: string
 *         departmentName:
 *           type: string
 *         departmentCode:
 *           type: string
 *         employmentStatus:
 *           type: string
 *           enum: [ACTIVE, ON_LEAVE, RESIGNED, RETIRED]
 *         qualification:
 *           type: string
 *         workType:
 *           type: string
 *         joiningDate:
 *           type: string
 *           format: date
 *         reportingManager:
 *           type: string
 *         noticePeriod:
 *           type: string
 *         gender:
 *           type: string
 *           enum: [Male, Female, Other]
 *         dateOfBirth:
 *           type: string
 *           format: date
 *         isActive:
 *           type: boolean
 *     FacultyResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         faculty:
 *           type: object
 *     FacultyBulkUploadResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         usersCreated:
 *           type: integer
 *         usersUpdated:
 *           type: integer
 *         facultyCreated:
 *           type: integer
 *         facultyUpdated:
 *           type: integer
 *         failedCount:
 *           type: integer
 *     FacultyListResponse:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *         faculty:
 *           type: array
 *           items:
 *             type: object
 *     MessageResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 */

/**
 * @swagger
 * /api/faculty:
 *   post:
 *     summary: Create a faculty user and profile
 *     tags: [Faculty]
 *     description: |
 *       Creates linked records in User and Faculty collections.
 *       If department does not exist and departmentName is given, department is auto-created.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FacultyCreateRequest'
 *     responses:
 *       201:
 *         description: Faculty created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyResponse'
 *       400:
 *         description: Missing required fields or duplicate email/employeeId
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (requires ADMIN)
 *       500:
 *         description: Server error
 */
router.post('/', protect, authorize('ADMIN'), addFaculty);

/**
 * @swagger
 * /api/faculty/upload:
 *   post:
 *     summary: Bulk upload faculty from Excel
 *     tags: [Faculty]
 *     description: |
 *       Upload `.xlsx` file as multipart `file` field.
 *       Creates or updates linked User/Faculty records per row and returns row-level failure summary.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Faculty upload sync completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyBulkUploadResponse'
 *       400:
 *         description: Missing file or malformed Excel
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (requires ADMIN)
 *       500:
 *         description: Server error
 */
router.post(
  '/upload',
  protect,
  authorize('ADMIN'),
  upload.single('file'),
  uploadMultipleFaculty
);

/**
 * @swagger
 * /api/faculty/{id}:
 *   put:
 *     summary: Update faculty and linked user details
 *     tags: [Faculty]
 *     description: |
 *       Updates Faculty fields plus linked User fields such as email/password/gender/dateOfBirth/isActive.
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
 *             $ref: '#/components/schemas/FacultyUpdateRequest'
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               marksheet:
 *                 type: string
 *                 format: binary
 *               experienceCertificate:
 *                 type: string
 *                 format: binary
 *               degreeCertificate:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Faculty updated successfully
 *       400:
 *         description: Invalid update payload or duplicate email/employeeId
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Faculty not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/faculty/{id}:
 *   delete:
 *     summary: Delete faculty and linked user
 *     tags: [Faculty]
 *     description: |
 *       Deletes both the faculty profile and linked user account.
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
 *         description: Faculty deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Faculty not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteFaculty);

/**
 * @swagger
 * /api/faculty:
 *   get:
 *     summary: Get all faculty
 *     tags: [Faculty]
 *     description: |
 *       Returns all faculty with linked user and department data.
 *       Optional filters: `departmentId`, `designation`, `employmentStatus`.
 *
 *       **Access:** Authenticated users with role FACULTY or ADMIN
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: designation
 *         schema:
 *           type: string
 *       - in: query
 *         name: employmentStatus
 *         schema:
 *           type: string
 *           enum: [ACTIVE, ON_LEAVE, RESIGNED, RETIRED]
 *     responses:
 *       200:
 *         description: Faculty list fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get('/', protect, authorize('FACULTY', 'ADMIN'), getAllFaculty);

/**
 * @swagger
 * /api/faculty/department-wise:
 *   get:
 *     summary: Get department-wise faculty count
 *     tags: [Faculty]
 *     description: |
 *       Aggregates total faculty by department.
 *
 *       **Access:** Authenticated users with role FACULTY or ADMIN
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department-wise faculty count
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get(
  '/department-wise',
  protect,
  authorize('FACULTY', 'ADMIN'),
  getDepartmentWise
);

/**
 * @swagger
 * /api/faculty/department-wise/{department}:
 *   get:
 *     summary: Get designation summary for a department
 *     tags: [Faculty]
 *     description: |
 *       Department can be ObjectId, name, shortName, or code.
 *       Returns both full designation breakdown and category summary for professor hierarchy.
 *
 *       **Access:** Authenticated users with role FACULTY or ADMIN
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department designation summary fetched
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server error
 */
router.get(
  '/department-wise/:department',
  protect,
  authorize('FACULTY', 'ADMIN'),
  getDepartmentWiseFaculty
);

/**
 * @swagger
 * /api/faculty/department-wise/{department}/list:
 *   get:
 *     summary: Get faculty list of a department
 *     tags: [Faculty]
 *     description: |
 *       Department can be ObjectId, name, shortName, or code.
 *
 *       **Access:** Authenticated users with role FACULTY or ADMIN
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department faculty list fetched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyListResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server error
 */
router.get(
  '/department-wise/:department/list',
  protect,
  authorize('FACULTY', 'ADMIN'),
  getDepartmentWiseFacultyList
);

/**
 * @swagger
 * /api/faculty/dashboard/stats:
 *   get:
 *     summary: Faculty dashboard summary stats
 *     tags: [Faculty]
 *     description: |
 *       Returns overall faculty count and grouped designation statistics.
 *
 *       **Access:** Authenticated users with role FACULTY or ADMIN
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats fetched
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get(
  '/dashboard/stats',
  protect,
  authorize('FACULTY', 'ADMIN'),
  getDashboardStats
);

export default router;
