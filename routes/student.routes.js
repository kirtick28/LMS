import express from 'express';
import multer from 'multer';
import {
  addStudent,
  updateStudent,
  deleteStudent,
  getAllStudents,
  getStudentsFiltered,
  swapStudentSection,
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
 *         academicYearId:
 *           type: string
 *           description: Existing AcademicYear ObjectId
 *         academicYearName:
 *           type: string
 *           example: 2026-2027
 *         startYear:
 *           type: integer
 *           example: 2026
 *         endYear:
 *           type: integer
 *           example: 2027
 *         batchId:
 *           type: string
 *           description: Existing Batch ObjectId
 *         batchName:
 *           type: string
 *           example: CSE-2026
 *         admissionYear:
 *           type: integer
 *           example: 2026
 *         graduationYear:
 *           type: integer
 *           example: 2030
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
 *       Returns students with related user/department/batch/academic history population.
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
 *         description: Filters by current section when academicYearId is not supplied
 *       - in: query
 *         name: academicYearId
 *         schema:
 *           type: string
 *         description: Filters students who have academic history in this academic year
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
 * /api/students/filter:
 *   get:
 *     summary: Filter students by department, batch, and current section
 *     tags: [Students]
 *     description: |
 *       Filters students by optional departmentId, batchId, sectionId, and academicYearId.
 *       For backward compatibility; prefer using GET /api/students with query params.
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
 *         name: academicYearId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Filtered students fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentListResponse'
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/filter', protect, getStudentsFiltered);

/**
 * @swagger
 * /api/students/swap-section:
 *   post:
 *     summary: Move selected students to a new section for a semester/year
 *     tags: [Students]
 *     description: |
 *       Marks previous current history entries as non-current and adds a new current academic history entry.
 *
 *       **Access:** Authenticated users with role ADMIN only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudentSwapSectionRequest'
 *     responses:
 *       200:
 *         description: Students moved successfully
 *       400:
 *         description: No students selected
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       403:
 *         description: Access denied (requires ADMIN)
 *       500:
 *         description: Server error
 */
router.post('/swap-section', protect, authorize('ADMIN'), swapStudentSection);

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
 *       If academicYearId is provided, counts are computed for that specific academic year.
 *       If academicYearId is not provided, counts use current enrollment.
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
 *       If academicYearId is provided, counts are computed for that specific academic year.
 *       If academicYearId is not provided, counts use current enrollment.
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
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *       500:
 *         description: Server error
 */
router.get('/stats/department-wise', protect, getStudentDepartmentWise);

export default router;
