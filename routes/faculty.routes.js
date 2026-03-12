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
 *   description: Faculty management and reporting
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     FacultyInput:
 *       type: object
 *       required:
 *         - salutation
 *         - firstName
 *         - lastName
 *         - gender
 *         - dateOfBirth
 *         - email
 *         - primaryPhone
 *         - qualification
 *         - workType
 *         - employeeId
 *         - joiningDate
 *         - designation
 *         - departmentId
 *       properties:
 *         salutation:
 *           type: string
 *           example: Dr.
 *         firstName:
 *           type: string
 *           example: Meera
 *         lastName:
 *           type: string
 *           example: Nair
 *         gender:
 *           type: string
 *           example: Female
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           example: 1988-07-24
 *         email:
 *           type: string
 *           example: meera.nair@college.edu
 *         password:
 *           type: string
 *           description: Defaults to 'sece@123' when omitted.
 *           example: SecurePass@123
 *         primaryPhone:
 *           type: string
 *           description: 10-digit mobile number.
 *           example: '9876543210'
 *         secondaryPhone:
 *           type: string
 *           nullable: true
 *           description: Optional 10-digit mobile number.
 *           example: '9123456780'
 *         qualification:
 *           type: string
 *           example: M.E. Computer Science
 *         workType:
 *           type: string
 *           enum: [Full Time, Contract, Part Time, Visiting]
 *           example: Full Time
 *         employeeId:
 *           type: string
 *           example: FAC1024
 *         joiningDate:
 *           type: string
 *           format: date
 *           example: 2021-06-10
 *         designation:
 *           type: string
 *           enum:
 *             - Professor
 *             - Associate Professor
 *             - Assistant Professor
 *             - HOD
 *             - Dean
 *             - Faculty
 *             - Professor of Practice
 *             - Lab Technician
 *             - Senior Lab Technician
 *             - Department Secretary
 *           example: Assistant Professor
 *         departmentId:
 *           type: string
 *           description: MongoDB ObjectId of Department.
 *           example: 65f0425db4d5f9a7d9e1134a
 *         reportingManager:
 *           type: string
 *           nullable: true
 *           description: MongoDB ObjectId of a Faculty record.
 *           example: 65f0429bb4d5f9a7d9e11355
 *         noticePeriod:
 *           type: string
 *           example: 30 days
 *         employmentStatus:
 *           type: string
 *           enum: [ACTIVE, ON_LEAVE, RESIGNED, RETIRED]
 *           example: ACTIVE
 *
 *     Faculty:
 *       allOf:
 *         - $ref: '#/components/schemas/FacultyInput'
 *         - type: object
 *           properties:
 *             _id:
 *               type: string
 *             userId:
 *               type: string
 *             status:
 *               type: string
 *               enum: [active, inactive]
 *             profileImage:
 *               type: string
 *               nullable: true
 *             documents:
 *               type: object
 *               properties:
 *                 marksheet:
 *                   type: string
 *                   nullable: true
 *                 experienceCertificate:
 *                   type: string
 *                   nullable: true
 *                 degreeCertificate:
 *                   type: string
 *                   nullable: true
 *             createdAt:
 *               type: string
 *               format: date-time
 *             updatedAt:
 *               type: string
 *               format: date-time
 *
 *     FacultyWithUserStatus:
 *       allOf:
 *         - $ref: '#/components/schemas/Faculty'
 *         - type: object
 *           properties:
 *             isActive:
 *               type: boolean
 *               description: Active status from linked user account.
 *             userId:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 gender:
 *                   type: string
 *                 dateOfBirth:
 *                   type: string
 *                   format: date-time
 *
 *     FacultyResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Faculty and User created successfully
 *         data:
 *           type: object
 *           properties:
 *             faculty:
 *               $ref: '#/components/schemas/Faculty'
 *
 *     FacultyListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Faculty list retrieved successfully
 *         data:
 *           type: object
 *           properties:
 *             facultyList:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FacultyWithUserStatus'
 *
 *     FacultyUploadSummaryResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Faculty upload sync completed successfully
 *         data:
 *           type: object
 *           properties:
 *             usersCreated:
 *               type: integer
 *               example: 10
 *             usersUpdated:
 *               type: integer
 *               example: 3
 *             facultyCreated:
 *               type: integer
 *               example: 9
 *             facultyUpdated:
 *               type: integer
 *               example: 4
 *             failedCount:
 *               type: integer
 *               example: 1
 *             failedRows:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   row:
 *                     type: integer
 *                     example: 5
 *                   message:
 *                     type: string
 *                     example: email, firstName, lastName, employeeId, primaryPhone and departmentCode are required
 *
 *     FacultyDashboardStatsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Dashboard stats retrieved successfully
 *         data:
 *           type: object
 *           properties:
 *             totalFaculty:
 *               type: integer
 *               example: 120
 *             deansAndHods:
 *               type: integer
 *               example: 8
 *             professors:
 *               type: integer
 *               example: 14
 *             associateAssistant:
 *               type: integer
 *               example: 76
 *             others:
 *               type: integer
 *               example: 22
 *
 *     DepartmentWiseFacultyCountResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Department wise counts retrieved successfully
 *         data:
 *           type: object
 *           properties:
 *             result:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   departmentId:
 *                     type: string
 *                     example: 65f0425db4d5f9a7d9e1134a
 *                   departmentName:
 *                     type: string
 *                     example: Computer Science and Engineering
 *                   departmentCode:
 *                     type: string
 *                     example: CSE
 *                   count:
 *                     type: integer
 *                     example: 25
 *
 *     DepartmentWiseFacultySummaryResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Department wise faculty summary retrieved successfully
 *         data:
 *           type: object
 *           properties:
 *             department:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 code:
 *                   type: string
 *             total:
 *               type: integer
 *               example: 25
 *             designationSummary:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *             categorySummary:
 *               type: object
 *               properties:
 *                 deansAndHods:
 *                   type: integer
 *                   example: 2
 *                 professors:
 *                   type: integer
 *                   example: 4
 *                 associateAssistant:
 *                   type: integer
 *                   example: 15
 *                 others:
 *                   type: integer
 *                   example: 4
 *
 *     DepartmentWiseFacultyListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Department wise faculty list retrieved successfully
 *         data:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 25
 *             faculty:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FacultyWithUserStatus'
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *         data:
 *           type: object
 */

/**
 * @swagger
 * /api/faculty:
 *   post:
 *     summary: Create a faculty record
 *     tags: [Faculty]
 *     description: |
 *       Creates both `User` (role FACULTY) and `Faculty` records.
 *
 *       **Required fields:** salutation, firstName, lastName, gender, dateOfBirth,
 *       email, primaryPhone, qualification, workType, employeeId, joiningDate,
 *       designation, departmentId.
 *
 *       **Access:** ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FacultyInput'
 *     responses:
 *       201:
 *         description: Faculty created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyResponse'
 *       400:
 *         description: Validation error or duplicate email/employeeId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (ADMIN role required)
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
 *       Uploads an Excel file and syncs users/faculty data in bulk.
 *
 *       **Required columns in Excel:**
 *       `email`, `firstName`, `lastName`, `employeeId`, `primaryPhone`, `departmentCode`,
 *       `salutation`, `gender`, `dateOfBirth`, `joiningDate`, `qualification`,
 *       `designation`, `workType`.
 *
 *       `departmentCode` must match an existing department code in the database.
 *       All operations are atomic: if any row fails, no changes are saved.
 *
 *       **Access:** ADMIN only
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
 *                 description: Excel file (.xlsx/.xls)
 *     responses:
 *       200:
 *         description: Faculty upload sync completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyUploadSummaryResponse'
 *       400:
 *         description: No file uploaded or invalid data in rows
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (ADMIN role required)
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
 *     summary: Update faculty details
 *     tags: [Faculty]
 *     description: |
 *       Updates faculty and linked user data.
 *
 *       Updatable fields include `departmentId`, `primaryPhone`, `secondaryPhone`,
 *       `designation`, `workType`, `employmentStatus`, and basic profile details.
 *
 *       **Access:** ADMIN only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Faculty ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               salutation:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               gender:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               primaryPhone:
 *                 type: string
 *                 description: 10-digit mobile number.
 *               secondaryPhone:
 *                 type: string
 *                 nullable: true
 *                 description: Optional 10-digit mobile number.
 *               employeeId:
 *                 type: string
 *               departmentId:
 *                 type: string
 *                 description: Department ObjectId
 *               designation:
 *                 type: string
 *                 enum:
 *                   - Professor
 *                   - Associate Professor
 *                   - Assistant Professor
 *                   - HOD
 *                   - Dean
 *                   - Faculty
 *                   - Professor of Practice
 *                   - Lab Technician
 *                   - Senior Lab Technician
 *                   - Department Secretary
 *               qualification:
 *                 type: string
 *               workType:
 *                 type: string
 *                 enum: [Full Time, Contract, Part Time, Visiting]
 *               joiningDate:
 *                 type: string
 *                 format: date
 *               reportingManager:
 *                 type: string
 *                 nullable: true
 *               noticePeriod:
 *                 type: string
 *               employmentStatus:
 *                 type: string
 *                 enum: [ACTIVE, ON_LEAVE, RESIGNED, RETIRED]
 *               isActive:
 *                 type: boolean
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyResponse'
 *       400:
 *         description: Invalid id, validation error, or duplicate constraints
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (ADMIN role required)
 *       404:
 *         description: Faculty or linked user not found
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
 *     summary: Deactivate linked user for faculty
 *     tags: [Faculty]
 *     description: |
 *       Soft delete behavior only: keeps faculty and user documents, and sets linked user `isActive=false`.
 *
 *       **Access:** ADMIN only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Faculty ObjectId
 *     responses:
 *       200:
 *         description: Faculty deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Faculty deactivated successfully
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid faculty id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (ADMIN role required)
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
 *       Returns faculty list with optional filters.
 *
 *       Filter by `departmentId`, `designation`, `employmentStatus`.
 *
 *       **Access:** FACULTY or ADMIN
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Department ObjectId
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
 *         description: Faculty list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyListResponse'
 *       400:
 *         description: Invalid departmentId
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/', protect, authorize('FACULTY', 'ADMIN', 'HOD'), getAllFaculty);

/**
 * @swagger
 * /api/faculty/department-wise:
 *   get:
 *     summary: Get department-wise faculty counts
 *     tags: [Faculty]
 *     description: |
 *       Returns faculty count grouped by `departmentId`.
 *
 *       **Access:** FACULTY or ADMIN
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department wise counts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentWiseFacultyCountResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
 *     summary: Get department-wise designation summary
 *     tags: [Faculty]
 *     description: |
 *       Returns designation/category summary for a department.
 *
 *       The `department` path value can be a Department ObjectId.
 *
 *       **Access:** FACULTY or ADMIN
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ObjectId
 *     responses:
 *       200:
 *         description: Department wise faculty summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentWiseFacultySummaryResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
 *     summary: Get department-wise faculty list
 *     tags: [Faculty]
 *     description: |
 *       Returns all faculty records for a department.
 *
 *       The `department` path value can be a Department ObjectId.
 *
 *       **Access:** FACULTY or ADMIN
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ObjectId
 *     responses:
 *       200:
 *         description: Department wise faculty list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepartmentWiseFacultyListResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
 *     summary: Get faculty dashboard stats
 *     tags: [Faculty]
 *     description: |
 *       Returns faculty dashboard aggregates used by the UI.
 *
 *       **Access:** FACULTY or ADMIN
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FacultyDashboardStatsResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
