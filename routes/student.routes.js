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
  getStudentStats
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
 *         departmentName:
 *           type: string
 *           description: Used to find/create department if departmentId is not supplied
 *           example: Computer Science and Engineering
 *         departmentCode:
 *           type: string
 *           example: CSE
 *         regulationId:
 *           type: string
 *           description: Existing Regulation ObjectId
 *         regulationStartYear:
 *           type: integer
 *           example: 2024
 *         regulationName:
 *           type: string
 *           example: R2024
 *         startYear:
 *           type: integer
 *           example: 2024
 *         endYear:
 *           type: integer
 *           example: 2028
 *         batchId:
 *           type: string
 *           description: Existing Batch ObjectId
 *         sectionId:
 *           type: string
 *           description: Existing Section ObjectId (if omitted, defaults to UNALLOCATED)
 *         sectionName:
 *           type: string
 *           example: A
 *         programDuration:
 *           type: integer
 *           example: 4
 *         semesterNumber:
 *           type: integer
 *           example: 1
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
 *         entryType:
 *           type: string
 *           enum: [REGULAR, LATERAL]
 *         academicStatus:
 *           type: string
 *           enum: [ACTIVE, DISCONTINUED, DROPPED, GRADUATED, SUSPENDED]
 *         password:
 *           type: string
 *         gender:
 *           type: string
 *           enum: [Male, Female, Other]
 *         dateOfBirth:
 *           type: string
 *           format: date
 *     StudentSwapSectionRequest:
 *       type: object
 *       required:
 *         - studentIds
 *         - newSectionId
 *         - academicYearId
 *         - semesterNumber
 *       properties:
 *         studentIds:
 *           type: array
 *           items:
 *             type: string
 *         newSectionId:
 *           type: string
 *         academicYearId:
 *           type: string
 *         semesterNumber:
 *           type: integer
 *     StudentResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         student:
 *           type: object
 *     StudentListResponse:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *         students:
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
 * /api/students:
 *   post:
 *     summary: Create a student
 *     tags: [Students]
 *     description: |
 *       Creates a student user and profile.
 *       If related academic entities are missing, controller auto-creates and reuses Department, AcademicYear, Batch, and default UNALLOCATED Section.
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
 *     summary: Update student and linked user details
 *     tags: [Students]
 *     description: |
 *       Updates student fields and linked user details (password/gender/dateOfBirth).
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
 *     summary: Update student semester and academic year
 *     tags: [Students]
 *     description: |
 *       Updates a student's semester number and automatically recalculates academic year based on batch start year.
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
 *             type: object
 *             required:
 *               - semesterNumber
 *             properties:
 *               semesterNumber:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
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
 *       Returns students with related user, department, batch, and section data.
 *       Optional filters are supported using query params.
 *
 *       **Access:** Any authenticated user (STUDENT, FACULTY, ADMIN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: academicYearStartYear
 *         schema:
 *           type: integer
 *       - in: query
 *         name: academicYearEndYear
 *         schema:
 *           type: integer
 *       - in: query
 *         name: academicYearName
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Students fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
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
 *       Uploads students from an Excel file and auto-creates/reuses academic context where needed.
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
 *       Optional `departmentId` filter is supported.
 *
 *       **Access:** Any authenticated user (STUDENT, FACULTY, ADMIN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student year-wise stats fetched successfully
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
 *       Uses current student records and groups by department and year derived from semester number.
 *
 *       **Access:** Any authenticated user (STUDENT, FACULTY, ADMIN)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department-wise student stats fetched successfully
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/stats/department-wise', protect, getStudentDepartmentWise);

export default router;
