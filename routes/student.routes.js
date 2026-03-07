import express from 'express';
import multer from 'multer';
import {
  addStudent,
  updateStudent,
  updateStudentSemester,
  deleteStudent,
  getAllStudents,
  // getStudentsFiltered,
  // swapStudentSection,
  uploadMultipleStudents,
  getStudentDepartmentWise,
  getStudentStats,
  semesterShift
} from '../controllers/student.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   name: Students
 *   description: Student management and academic assignment workflows
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     StudentCreateRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *         - registerNumber
 *         - departmentId
 *         - batchId
 *       properties:
 *         email:
 *           type: string
 *           example: student1@example.com
 *         password:
 *           type: string
 *           example: password123
 *         firstName:
 *           type: string
 *           example: John
 *         lastName:
 *           type: string
 *           example: Doe
 *         registerNumber:
 *           type: string
 *           example: REG001
 *         rollNumber:
 *           type: string
 *           example: 22CS001
 *         semesterNumber:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         gender:
 *           type: string
 *           enum: [Male, Female, Other]
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           example: 2005-05-11
 *         departmentId:
 *           type: string
 *           description: Existing Department ObjectId
 *           example: 65f0425db4d5f9a7d9e1134a
 *         batchId:
 *           type: string
 *           description: Existing Batch ObjectId
 *           example: 65f0425db4d5f9a7d9e1134b
 *         sectionId:
 *           type: string
 *           description: Existing Section ObjectId (optional, defaults to UNALLOCATED section for the batch program)
 *           example: 65f0425db4d5f9a7d9e1134c
 *     StudentUpdateRequest:
 *       type: object
 *       properties:
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         registerNumber:
 *           type: string
 *         rollNumber:
 *           type: string
 *         departmentId:
 *           type: string
 *         batchId:
 *           type: string
 *         sectionId:
 *           type: string
 *         semesterNumber:
 *           type: integer
 *           minimum: 1
 *         entryType:
 *           type: string
 *           enum: [REGULAR, LATERAL]
 *         status:
 *           type: string
 *           enum: [active, graduated, dropped]
 *     StudentSemesterUpdateRequest:
 *       type: object
 *       required:
 *         - semesterNumber
 *       properties:
 *         semesterNumber:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *     Student:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         departmentId:
 *           type: string
 *         batchId:
 *           type: string
 *         sectionId:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         registerNumber:
 *           type: string
 *         rollNumber:
 *           type: string
 *         entryType:
 *           type: string
 *           enum: [REGULAR, LATERAL]
 *         status:
 *           type: string
 *           enum: [active, graduated, dropped]
 *         semesterNumber:
 *           type: integer
 *         isActive:
 *           type: boolean
 *         fullName:
 *           type: string
 *     StudentResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             student:
 *               $ref: '#/components/schemas/Student'
 *     StudentListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             students:
 *               type: array
 *               items:
 *                 type: object
 *     StudentUploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             inserted:
 *               type: integer
 *             skipped:
 *               type: integer
 *             failed:
 *               type: integer
 *     StudentYearWiseStatsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             totalStudents:
 *               type: integer
 *             yearWise:
 *               type: object
 *               properties:
 *                 firstYear:
 *                   type: integer
 *                 secondYear:
 *                   type: integer
 *                 thirdYear:
 *                   type: integer
 *                 fourthYear:
 *                   type: integer
 *     StudentDepartmentWiseStatsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             totalDepartments:
 *               type: integer
 *             departments:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   departmentId:
 *                     type: string
 *                   departmentName:
 *                     type: string
 *                   totalStudents:
 *                     type: integer
 *                   yearWise:
 *                     type: object
 *                     properties:
 *                       firstYear:
 *                         type: integer
 *                       secondYear:
 *                         type: integer
 *                       thirdYear:
 *                         type: integer
 *                       fourthYear:
 *                         type: integer
 *     SemesterShiftResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             totalStudentsProcessed:
 *               type: integer
 *             studentsPromoted:
 *               type: integer
 *             studentsGraduated:
 *               type: integer
 *             academicYearChanged:
 *               type: boolean
 *             newAcademicYearName:
 *               type: string
 *     MessageResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 */

/**
 * @swagger
 * /api/students:
 *   post:
 *     summary: Create a student
 *     tags: [Students]
 *     description: |
 *       Creates a student user and student profile.
 *       Department and batch must already exist. If `sectionId` is not provided,
 *       the controller maps the student to the `UNALLOCATED` section within the batch program.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudentCreateRequest'
 *     responses:
 *       201:
 *         description: Student created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentResponse'
 *       400:
 *         description: Missing required fields or duplicate email/registerNumber
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       500:
 *         description: Server error
 */
router.post('/', protect, authorize('ADMIN'), addStudent);

/**
 * @swagger
 * /api/students/{id}:
 *   put:
 *     summary: Update student profile details
 *     tags: [Students]
 *     description: |
 *       Updates student fields such as name, register number, department/batch/section,
 *       entry type, status, and semester.
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
 *             $ref: '#/components/schemas/StudentUpdateRequest'
 *     responses:
 *       200:
 *         description: Student updated successfully
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.put('/:id', protect, authorize('ADMIN'), updateStudent);

/**
 * @swagger
 * /api/students/{id}/semester:
 *   patch:
 *     summary: Update student semester
 *     tags: [Students]
 *     description: |
 *       Updates a student's semester number and ensures an academic record exists
 *       for the active academic year and requested semester.
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
 *             $ref: '#/components/schemas/StudentSemesterUpdateRequest'
 *     responses:
 *       200:
 *         description: Student semester updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:id/semester',
  protect,
  authorize('ADMIN'),
  updateStudentSemester
);

/**
 * @swagger
 * /api/students/{id}:
 *   delete:
 *     summary: Delete student and linked user
 *     tags: [Students]
 *     description: |
 *       Deletes the student profile and linked user account.
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
 *         description: Student deleted successfully
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, authorize('ADMIN'), deleteStudent);

/**
 * @swagger
 * /api/students:
 *   get:
 *     summary: Get all students
 *     tags: [Students]
 *     description: |
 *       Returns students with optional filters.
 *       When `academicYearId` is provided, data is resolved via academic records and
 *       supports academic-year/semester scoped views.
 *
 *       **Access:** Any authenticated user (STUDENT, FACULTY, ADMIN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academicYearId
 *         schema:
 *           type: string
 *       - in: query
 *         name: semesterNumber
 *         schema:
 *           type: integer
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sectionId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, graduated, dropped]
 *       - in: query
 *         name: admissionYear
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Students fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentListResponse'
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/', protect, getAllStudents);

/**
 * @swagger
 * /api/students/upload:
 *   post:
 *     summary: Bulk upload students from Excel file
 *     tags: [Students]
 *     description: |
 *       Uploads students from an Excel file. Each row should contain
 *       `email`, `firstName`, `lastName`, `registerNumber`, `departmentId`, and `batchId`.
 *       Optional `sectionId` defaults to the `UNALLOCATED` section in the corresponding batch program.
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
 *         description: Upload completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentUploadResponse'
 *       400:
 *         description: No file uploaded
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
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
  uploadMultipleStudents
);

/**
 * @swagger
 * /api/students/stats/year-wise:
 *   get:
 *     summary: Get total students and 1st-to-4th year counts
 *     tags: [Students]
 *     description: |
 *       Returns total students and year-wise counts.
 *       Optional filters: `academicYearId`, `departmentId`.
 *
 *       **Access:** Any authenticated user (STUDENT, FACULTY, ADMIN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academicYearId
 *         schema:
 *           type: string
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student year-wise stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentYearWiseStatsResponse'
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/stats/year-wise', protect, getStudentStats);

/**
 * @swagger
 * /api/students/stats/department-wise:
 *   get:
 *     summary: Get department-wise student count with 1st-to-4th year split
 *     tags: [Students]
 *     description: |
 *       Returns department-wise totals and year-wise counts.
 *       Optional `academicYearId` filters stats using academic records for that year.
 *
 *       **Access:** Any authenticated user (STUDENT, FACULTY, ADMIN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academicYearId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department-wise student stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentDepartmentWiseStatsResponse'
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/stats/department-wise', protect, getStudentDepartmentWise);

/**
 * @swagger
 * /api/students/semester-shift:
 *   post:
 *     summary: Perform global semester shift for active students
 *     tags: [Students]
 *     description: |
 *       Promotes all active students to next semester in bulk.
 *       Students crossing the final semester are marked as graduated.
 *       During even-to-odd transition, academic year may be switched/created.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Global semester shift completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SemesterShiftResponse'
 *       400:
 *         description: No active students found or shift safety triggered
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       500:
 *         description: Server error
 */
router.post('/semester-shift', protect, authorize('ADMIN'), semesterShift);

export default router;
