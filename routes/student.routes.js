import express from 'express';
import multer from 'multer';
import {
  addStudent,
  updateStudent,
  deleteStudent,
  getAllStudents,
  uploadMultipleStudents,
  getStudentDepartmentWise,
  getStudentStats,
  semesterShift,
  getSemesterShiftInfo
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
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minimum: 6
 *         gender:
 *           type: string
 *           enum: [Male, Female, Other]
 *         dateOfBirth:
 *           type: string
 *           format: date
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
 *         isActive:
 *           type: boolean
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
 *         fullName:
 *           type: string
 *     StudentAcademicView:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         registerNumber:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, graduated, dropped]
 *         semesterNumber:
 *           type: integer
 *         yearLevel:
 *           type: integer
 *         academicYear:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *         department:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             code:
 *               type: string
 *         batch:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             startYear:
 *               type: integer
 *             endYear:
 *               type: integer
 *         section:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *         user:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             email:
 *               type: string
 *             gender:
 *               type: string
 *         isActive:
 *           type: boolean
 *     StudentCreateResponse:
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
 *             studentId:
 *               type: string
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
 *                 oneOf:
 *                   - $ref: '#/components/schemas/Student'
 *                   - $ref: '#/components/schemas/StudentAcademicView'
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
 *             departmentId:
 *               type: string
 *             batchId:
 *               type: string
 *             totalStudents:
 *               type: integer
 *             studentsPromoted:
 *               type: integer
 *             studentsGraduated:
 *               type: integer
 *             academicYearChanged:
 *               type: boolean
 *             academicYear:
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
 *               $ref: '#/components/schemas/StudentCreateResponse'
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
 *     summary: Update student profile and academic state
 *     tags:
 *       - Students
 *     description: |
 *       Updates student profile fields and handles complex academic state transitions.
 *
 *       **Key Behaviors:**
 *
 *       - **Profile Updates:**
 *         Modifies basic information, linked user fields (including `isActive`),
 *         status, and register number (ensures uniqueness).
 *
 *       - **Section Changes:**
 *         Updating `sectionId` automatically cascades and updates the student's current
 *         `StudentAcademicRecord`.
 *
 *       - **Semester Corrections:**
 *         Updating `semesterNumber` triggers a historical correction. The system safely
 *         modifies or creates the `StudentAcademicRecord` for the target semester while
 *         preserving past academic history constraints.
 *
 *       **Access:** Authenticated users with role `ADMIN` only.
 *
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: MongoDB ObjectId of the student
 *         schema:
 *           type: string
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudentUpdateRequest'
 *
 *     responses:
 *       200:
 *         description: Student updated successfully
 *
 *       400:
 *         description: Bad request (e.g., duplicate register number, invalid semester, or invalid relationships)
 *
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *
 *       403:
 *         description: Access denied (requires ADMIN role)
 *
 *       404:
 *         description: Student not found
 *
 *       500:
 *         description: Internal server error
 */
router.put('/:id', protect, authorize('ADMIN'), updateStudent);

/**
 * @swagger
 * /api/students/{id}:
 *   delete:
 *     summary: Delete student and deactivate linked user
 *     tags: [Students]
 *     description: |
 *       Deletes the student profile and marks the linked user account as inactive.
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
 *       If `academicYearId` is provided, students are resolved from academic records
 *       (academic-year scoped view with joined context). Otherwise, students are read
 *       directly from the `students` collection with populated relations.
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
 *           enum: [active, completed, graduated, dropped]
 *         description: For `academicYearId` mode, filters by academic record status (defaults to `active`).
 *     responses:
 *       200:
 *         description: Students fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentListResponse'
 *       400:
 *         description: Invalid filter parameter (for example malformed ObjectId)
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
 *       `email`, `firstName`, `lastName`, `registerNumber`, `departmentCode`, and `batchName`.
 *       Section assignment is auto-allocated based on section capacity.
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed]
 *         description: Applied when `academicYearId` is provided. Defaults to `active`.
 *     responses:
 *       200:
 *         description: Student year-wise stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentYearWiseStatsResponse'
 *       400:
 *         description: Invalid academicYearId or departmentId format
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
 *         name: departmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: academicYearId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed]
 *         description: Applied when `academicYearId` is provided. Defaults to `active`.
 *     responses:
 *       200:
 *         description: Department-wise student stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentDepartmentWiseStatsResponse'
 *       400:
 *         description: Invalid academicYearId format
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
 *     summary: Shift semester for a specific department and batch
 *     tags: [Students]
 *     description: >
 *       Promotes all active students belonging to a specific department and batch
 *       to the next semester.
 *
 *       Key Behaviors:
 *       - Semester Promotion: All active students (status = "active") are promoted to the next semester.
 *       - Graduation Handling: Students moving beyond semester 8 are automatically marked as "graduated".
 *       - Academic Year Transition:
 *           * Odd → Even (1→2, 3→4, 5→6, 7→8): Academic year remains the same.
 *           * Even → Odd (2→3, 4→5, 6→7): A new academic year is activated or created automatically.
 *       - Safety Check: Prevents accidental double execution if records for the upcoming semester already exist.
 *
 *       Note: This operation only affects students matching the provided departmentId and batchId.
 *
 *       Access: Authenticated users with role ADMIN only.
 *
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - departmentId
 *               - batchId
 *             properties:
 *               departmentId:
 *                 type: string
 *                 description: MongoDB ObjectId of the department
 *               batchId:
 *                 type: string
 *                 description: MongoDB ObjectId of the batch
 *
 *     responses:
 *       200:
 *         description: Semester shift completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SemesterShiftResponse'
 *
 *       400:
 *         description: Bad request (missing parameters, no students found, or shift already executed)
 *
 *       401:
 *         description: Unauthorized (JWT missing or invalid)
 *
 *       403:
 *         description: Access denied (requires ADMIN role)
 *
 *       500:
 *         description: Server error
 */
router.post('/semester-shift', protect, authorize('ADMIN'), semesterShift);

/**
 * @swagger
 * /api/students/semester-shift-info:
 *   get:
 *     summary: Get semester shift information for a department and batch
 *     tags: [Students]
 *     description: >
 *       Returns the current semester of students for a given department and batch.
 *       This endpoint helps administrators verify the current semester before
 *       performing a semester shift.
 *
 *       Key Behaviors:
 *       - Finds active students for the provided department and batch.
 *       - Determines the current semester from student records.
 *       - Calculates the next semester.
 *       - Indicates whether the academic year will change (Even → Odd transition).
 *
 *       If no students exist for the department and batch, the semester is considered
 *       not initialized.
 *
 *       Access: Authenticated users with role ADMIN only.
 *
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the department
 *
 *       - in: query
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the batch
 *
 *     responses:
 *       200:
 *         description: Semester shift information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentSemester:
 *                       type: integer
 *                       nullable: true
 *                     nextSemester:
 *                       type: integer
 *                       nullable: true
 *                     academicYearChange:
 *                       type: boolean
 *                     studentCount:
 *                       type: integer
 *
 *       400:
 *         description: Missing departmentId or batchId
 *
 *       401:
 *         description: Unauthorized
 *
 *       403:
 *         description: Access denied (requires ADMIN)
 *
 *       500:
 *         description: Server error
 */
router.get(
  '/semester-shift-info',
  protect,
  authorize('ADMIN'),
  getSemesterShiftInfo
);

export default router;
