# Backend README

## 1. Backend Overview

This backend is the operational core of the LMS. It stores academic structure, authenticates users, coordinates role-based workflows, and exposes the APIs consumed by the frontend.

### Architecture style

The project uses a modular Express + Mongoose architecture:

- `routes` define the API surface
- `middlewares` handle auth, uploads, and global errors
- `controllers` implement request orchestration and business rules
- `models` define MongoDB collections and relationships
- `utils` contain helper primitives and shared domain logic

It is close to a controller-driven MVC style, but organized more as feature modules than strict layered services.

### Tech stack

- Node.js
- Express 5
- MongoDB + Mongoose
- JWT authentication
- bcrypt password hashing
- multer file uploads
- nodemailer email sending
- Swagger docs
- Jest + Supertest for testing

### Purpose of the backend

- authenticate and authorize users
- manage departments, batches, regulations, curriculum, subjects, sections
- manage students and faculty
- allocate faculty to teach subject components
- generate and synchronize classrooms
- create timetables and validate clashes
- store course plans
- mark attendance and process attendance corrections
- drive student/faculty dashboards and calendar data

## 2. Core Terminologies and Data Models

### User

Fields:

- `email`
- `password`
- `role`
- `isActive`
- `gender`
- `dateOfBirth`
- `lastLogin`
- reset password fields

Relationships:

- one user can link to one faculty profile or one student profile

Example:

```json
{
  "email": "student@college.edu",
  "role": "STUDENT",
  "isActive": true
}
```

### Student

Fields:

- `userId`
- `departmentId`
- `batchId`
- `sectionId`
- `firstName`
- `lastName`
- `registerNumber`
- `rollNumber`
- `entryType`
- `status`
- `semesterNumber`

Relationships:

- belongs to one user, department, batch, and section
- has many academic records

Example:

```json
{
  "registerNumber": "23CS001",
  "semesterNumber": 3,
  "status": "active"
}
```

### Faculty

Fields:

- `userId`
- `departmentId`
- `salutation`
- `firstName`
- `lastName`
- `employeeId`
- `designation`
- `primaryPhone`
- `workType`
- `joiningDate`
- `employmentStatus`
- `documents`

Relationships:

- belongs to one user and department
- participates in assignments, sections, course plans, classrooms, and attendance workflows

Note:

- when a faculty designation is `HOD`, auth logic upgrades the effective request role to `HOD`

### Department

Fields:

- `name`
- `code`
- `program`
- `isActive`

Relationships:

- parent context for faculty, students, subjects, and curriculum

### Batch

Fields:

- `startYear`
- `endYear`
- `programDuration`
- `name`
- `isActive`

Relationships:

- linked to students and batch programs

### Regulation

Fields:

- `name`
- `startYear`
- `totalSemesters`
- `isActive`

Relationships:

- linked to subjects, curriculum, and batch programs

### BatchProgram

Fields:

- `batchId`
- `departmentId`
- `regulationId`

Relationships:

- parent context for sections
- bridge between cohort and academic rules

### Section

Fields:

- `name`
- `batchProgramId`
- `advisor`
- `tutors`
- `venue`
- `capacity`
- `isActive`

Relationships:

- students belong to sections
- timetable, classroom, and faculty assignment are section-based

### Subject

Fields:

- `name`
- `shortName`
- `code`
- `departmentId`
- `regulationId`
- `courseCategory`
- `deliveryType`
- `credits`
- `isActive`

Relationships:

- owns subject components
- appears in curriculum and classrooms

### SubjectComponent

Fields:

- `subjectId`
- `name`
- `shortName`
- `componentType`
- `hours`
- `isActive`

Relationships:

- faculty are assigned to components, not directly to subjects

### Curriculum

Fields:

- `departmentId`
- `regulationId`
- `semesters[]`
  - `semesterNumber`
  - `subjects[]`
- `isActive`

Relationships:

- decides which subjects belong to a semester for a department/regulation combination

### AcademicYear

Fields:

- `name`
- `startYear`
- `endYear`
- `startMonth`
- `endMonth`
- `isActive`

Relationships:

- used by student records, timetable, classrooms, and attendance

### StudentAcademicRecord

Fields:

- `studentId`
- `academicYearId`
- `semesterNumber`
- `sectionId`
- `status`

Purpose:

- stores year-wise academic history, not just current state

### FacultyAssignment

Fields:

- `facultyIds[]`
- `sectionId`
- `subjectComponentId`
- `academicYearId`
- `semesterNumber`
- `venue`
- `assignedBy`
- `status`

Purpose:

- this is the central teaching-assignment record in the system

### Timetable

Fields:

- `sectionId`
- `academicYearId`
- `semesterNumber`
- `slots[]`

### TimetableEntry

Fields:

- `timetableId`
- `day`
- `slotOrder`
- `facultyAssignmentId`
- `additionalHourId`

### Classroom

Fields:

- `sectionId`
- `subjectId`
- `academicYearId`
- `semesterNumber`
- `name`
- `status`
- `createdBy`
- `joinCode`

Purpose:

- digital class space for one teaching context

### ClassroomMember

Fields:

- `classroomId`
- `userId`
- `role`
- `status`

### Topic

Fields:

- `classroomId`
- `name`
- `isDefault`

### ClassroomPost

Fields:

- `classroomId`
- `createdBy`
- `createdByRole`
- `type`
- `title`
- `instructions`
- `topicId`
- `attachments`

Types:

- `announcement`
- `assignment`
- `quiz`
- `question`
- `material`

### Assignment

Fields:

- `postId`
- `points`
- `isUngraded`
- `dueDate`
- `submissionType`
- `allowLateSubmission`

### Quiz

Fields:

- `postId`
- `totalMarks`
- `dueDate`
- `isAutoGraded`
- `questions[]`
- `allowLateSubmission`

### Submission

Fields:

- `postId`
- `assignmentId`
- `quizId`
- `submissionType`
- `studentId`
- `attachments`
- `textSubmission`
- `linkSubmission`
- `quizAnswers`
- `marks`
- `status`
- `isLate`
- `submittedAt`

### Attendance

Fields:

- `classroom`
- `timetableEntry`
- `faculty`
- `subject`
- `subjectComponent`
- `slotOrder`
- `day`
- `date`
- `dateString`
- `records[]`
- `status`
- `isLocked`

### AttendanceRequest

Fields:

- `attendanceRecord`
- `faculty`
- `requestedChanges[]`
- `reason`
- `approvalStatus`
- `reviewedBy`
- `reviewRemarks`
- `resolvedAt`

## 3. Folder Structure

```text
backend/
  config/
  controllers/
  middlewares/
  models/
  public/
  routes/
  tests/
  utils/
  app.js
  server.js
```

### Deep explanation

- `config`
  - infrastructure config
  - `DB.js` connects MongoDB using `MONGO_URI`

- `controllers`
  - request-specific business logic
  - examples:
    - `student.controller.js`
    - `facultyAssignment.controller.js`
    - `timeTable.controller.js`
    - `attendance.controller.js`
    - `classroomPost.controller.js`

- `middlewares`
  - cross-cutting request processing
  - `auth.middleware.js`: JWT verification + role authorization
  - `upload.middleware.js`: file upload to `public/pdf`
  - `error.middleware.js`: standardized error handling

- `models`
  - Mongoose schemas, hooks, indexes, and relationships

- `routes`
  - endpoint declarations that wire HTTP paths to controllers

- `utils`
  - reusable helpers and abstractions
  - examples:
    - `AppError.js`
    - `catchAsync.js`
    - `generateToken.js`
    - `classroomAccess.js`
    - `StudentHelper.js`
    - `FacultyHelper.js`

- `public`
  - static assets and uploaded documents
  - classroom files end up in `public/pdf`

- `tests`
  - integration-style API tests

### Execution flow

```text
Route
  -> Middleware
  -> Controller
  -> Model / Database
  -> JSON Response
```

## 4. Request Lifecycle

The standard lifecycle in this backend is:

```text
Client
  -> Route
  -> Middleware
  -> Controller
  -> Database
  -> Response
```

### Real example: create student

1. client calls `POST /api/students`
2. `protect` verifies JWT
3. `authorize('ADMIN')` checks role
4. `student.controller.addStudent` validates input and context
5. Mongo transaction creates `User`, `Student`, and `StudentAcademicRecord`
6. JSON response returns the new student ID

## 5. Middlewares

### Authentication middleware

File: `middlewares/auth.middleware.js`

Purpose:

- extract Bearer token
- verify JWT with `JWT_SECRET`
- load the user
- reject inactive users
- convert faculty users with designation `HOD` into effective `HOD` role

When it runs:

- before almost all protected APIs

Example scenario:

- a faculty account with designation `HOD` logs in
- later protected requests are treated as HOD requests

### Authorization middleware

Purpose:

- allow only specific roles on specific APIs

Examples:

- batch creation: admin only
- timetable save: HOD only
- attendance request resolution: HOD only

### Upload middleware

File: `middlewares/upload.middleware.js`

Purpose:

- store uploaded files in `public/pdf`

When it runs:

- classroom post creation/update
- assignment submission

### Error handling middleware

File: `middlewares/error.middleware.js`

Purpose:

- transform raw runtime/database errors into readable API responses

Handled cases:

- cast errors
- duplicate key errors
- validation errors
- JWT errors
- multer errors

Behavior:

- detailed dev responses in development
- safer operational responses in production

## 6. API Endpoints Documentation

All protected routes require:

```http
Authorization: Bearer <jwt>
```

### Auth APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`

Example request:

```json
{
  "email": "admin@college.edu",
  "password": "secret123"
}
```

Example response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "_id": "userId",
    "email": "admin@college.edu",
    "role": "ADMIN",
    "token": "jwt"
  }
}
```

### Department APIs

- `POST /api/departments`
- `GET /api/departments`
- `GET /api/departments/:id`
- `PUT /api/departments/:id`
- `DELETE /api/departments/:id`

Create body:

```json
{
  "name": "Computer Science and Engineering",
  "code": "CSE",
  "program": "B.E."
}
```

### Batch APIs

- `POST /api/batches`
- `GET /api/batches`
- `GET /api/batches/:id`
- `PUT /api/batches/:id`
- `DELETE /api/batches/:id`

Create body:

```json
{
  "startYear": 2023,
  "endYear": 2027,
  "programDuration": 4,
  "regulation": "regulationId"
}
```

### Regulation APIs

- `POST /api/regulations`
- `GET /api/regulations`
- `GET /api/regulations/:id`
- `PUT /api/regulations/:id`
- `DELETE /api/regulations/:id`

### Curriculum APIs

- `POST /api/curriculums`
- `GET /api/curriculums`
- `GET /api/curriculums/:id`
- `PUT /api/curriculums/:id`
- `DELETE /api/curriculums/:id`

Create body:

```json
{
  "departmentId": "deptId",
  "regulationId": "regId",
  "semesters": [
    {
      "semesterNumber": 1,
      "subjects": ["subject1", "subject2"]
    }
  ]
}
```

### Subject APIs

- `POST /api/subjects`
- `POST /api/subjects/upload/:departmentId/:regulationId`
- `GET /api/subjects`
- `GET /api/subjects/by-semester`
- `GET /api/subjects/:id`
- `PUT /api/subjects/:id`
- `DELETE /api/subjects/:id`

Create body:

```json
{
  "name": "Data Structures",
  "shortName": "DS",
  "code": "CS2301",
  "credits": 4,
  "deliveryType": "TP",
  "courseCategory": "Professional Core",
  "departmentId": "deptId",
  "regulationId": "regId"
}
```

### Section APIs

- `POST /api/sections`
- `GET /api/sections`
- `GET /api/sections/current-year/:departmentId`
- `GET /api/sections/:id`
- `PUT /api/sections/:id`
- `DELETE /api/sections/:id`
- `PATCH /api/sections/reallocate`

### Student APIs

- `POST /api/students`
- `PUT /api/students/:id`
- `DELETE /api/students/:id`
- `GET /api/students`
- `POST /api/students/upload`
- `GET /api/students/stats/year-wise`
- `GET /api/students/stats/department-wise`
- `POST /api/students/semester-shift`
- `GET /api/students/semester-shift-info`
- `GET /api/students/dashboard`
- `GET /api/students/attendance`

### Faculty APIs

- `POST /api/faculty`
- `GET /api/faculty/me`
- `POST /api/faculty/upload`
- `PUT /api/faculty/:id`
- `DELETE /api/faculty/:id`
- `GET /api/faculty`
- `GET /api/faculty/department-wise`
- `GET /api/faculty/department-wise/:department`
- `GET /api/faculty/department-wise/:department/list`
- `GET /api/faculty/dashboard/stats`

### Faculty Assignment APIs

- `POST /api/assign-faculty`
- `GET /api/assign-faculty`
- `GET /api/assign-faculty/academic-structure/:departmentId`
- `GET /api/assign-faculty/:id`

Allocation body:

```json
{
  "sectionId": "sectionId",
  "academicYearId": "academicYearId",
  "semesterNumber": 3,
  "allocations": [
    {
      "subjectComponentId": "componentId",
      "facultyIds": ["facultyId1", "facultyId2"]
    }
  ]
}
```

### Timetable APIs

- `POST /api/timetable`
- `GET /api/timetable`
- `GET /api/timetable/components`
- `GET /api/timetable/faculty`
- `GET /api/timetable/attendance-entries`

### Classroom APIs

- `GET /api/classroom`
- `GET /api/classroom/:id`
- `PUT /api/classroom/:id`

### Classroom Member APIs

- `PATCH /api/classroom/:classroomId/members/respond`
- `POST /api/classroom/:classroomId/members/join/:code`
- `POST /api/classroom/:classroomId/members/invite`
- `GET /api/classroom/:classroomId/members/eligible/:type`
- `GET /api/classroom/:classroomId/members`

### Classroom Post APIs

- `GET /api/classroom/:classroomId/posts`
- `GET /api/classroom/:classroomId/posts/stream`
- `GET /api/classroom/:classroomId/posts/topic`
- `GET /api/classroom/:classroomId/posts/item/:postId`
- `GET /api/classroom/:classroomId/posts/item/:postId/submissions`
- `POST /api/classroom/:classroomId/posts/item/:postId/submission`
- `POST /api/classroom/:classroomId/posts`
- `POST /api/classroom/:classroomId/posts/topic`
- `POST /api/classroom/:classroomId/posts/:postId/comments`
- `DELETE /api/classroom/:classroomId/posts/comments/:commentId`
- `PATCH /api/classroom/:classroomId/posts/topic/:topicId`
- `DELETE /api/classroom/:classroomId/posts/topic/:topicId`
- `PATCH /api/classroom/:classroomId/posts/:type/:postId`
- `DELETE /api/classroom/:classroomId/posts/:type/:postId`

### Course Plan APIs

- `GET /api/coursePlan`
- `POST /api/coursePlan`

### Attendance APIs

- `POST /api/attendance/mark`
- `GET /api/attendance/requests`
- `GET /api/attendance/view`
- `POST /api/attendance/request-change`
- `PATCH /api/attendance/resolve-request`

Mark attendance body:

```json
{
  "timetableEntryId": "entryId",
  "classroomId": "classroomId",
  "dateString": "2026-04-19",
  "students": [
    { "studentId": "studentId1", "status": "Present" },
    { "studentId": "studentId2", "status": "Absent" }
  ]
}
```

### Academic Calendar APIs

- `GET /api/academic-calendar`
- `POST /api/academic-calendar`
- `POST /api/academic-calendar/bulk`
- `GET /api/academic-calendar/date/:dateString`
- `PATCH /api/academic-calendar/:id`
- `DELETE /api/academic-calendar/:id`

### Calendar Aggregation API

- `GET /api/calendar`

## 7. Business Logic Flows

### Student creation flow

1. validate required fields
2. check duplicate email and register number
3. resolve department, batch, and section context
4. validate section capacity
5. get active academic year
6. validate semester against batch and active year
7. start transaction
8. create `User`
9. create `Student`
10. create `StudentAcademicRecord`
11. commit transaction

### Faculty bulk upload flow

1. read Excel rows
2. validate required fields and normalize values
3. resolve department by code
4. start transaction
5. create or update matching user/faculty pairs
6. if any row fails, abort the whole transaction
7. otherwise commit all records

### Batch creation flow

1. create batch
2. fetch all departments
3. create batch-program rows for each department
4. create `UNALLOCATED` section for each batch program

### Faculty assignment flow

1. load section and academic year
2. resolve batch program from section
3. load matching curriculum
4. validate that the assigned subject components belong to semester subjects
5. validate faculty IDs
6. insert, update, or delete assignment records
7. synchronize classrooms, faculty memberships, and default topics

### Timetable save flow

1. upsert timetable slot structure
2. normalize class-slot ordering
3. validate faculty clashes across existing institutional timetable entries
4. delete old timetable entries for that section timetable
5. upsert additional hours
6. create fresh timetable entries
7. update venue values on faculty assignments

### Classroom invitation flow

1. faculty loads eligible users
2. backend excludes active members and pending invites
3. faculty submits invite list
4. backend validates role and section eligibility
5. backend creates invitation token and emails invite URL
6. user accepts or rejects
7. accepted invitation creates classroom membership

### Assignment and quiz submission flow

1. student opens post details
2. backend hydrates post metadata and submission context
3. submission request arrives
4. backend blocks duplicate final submissions
5. validates due date and allowed submission type
6. stores `Submission`
7. quizzes may auto-grade immediately

### Attendance flow

1. faculty submits timetable entry, classroom, date, and student statuses
2. backend validates date format and role rules
3. rejects holiday dates
4. validates classroom, timetable, subject, assignment, and section membership
5. creates locked attendance record
6. later corrections must go through attendance request flow unless HOD updates directly

### Semester shift flow

1. admin picks department + batch
2. backend ensures active students are aligned on one semester
3. closes active academic records
4. archives current-semester classrooms
5. promotes students or marks them graduated
6. creates next academic-year records where needed

## 8. Database Design

### Collections

Core collections include:

- `users`
- `students`
- `faculties`
- `departments`
- `batches`
- `regulations`
- `batchprograms`
- `sections`
- `subjects`
- `subjectcomponents`
- `curriculums`
- `academicyears`
- `studentacademicrecords`
- `facultyassignments`
- `timetables`
- `timetableentries`
- `classrooms`
- `classroommembers`
- `topics`
- `classroomposts`
- `assignments`
- `quizzes`
- `submissions`
- `attendances`
- `attendancerequests`
- `academiccalendars`

### Relationship types

- one-to-one:
  - `User -> Student`
  - `User -> Faculty`

- one-to-many:
  - `Department -> Faculty`
  - `Department -> Student`
  - `BatchProgram -> Section`
  - `Classroom -> Topic`
  - `Classroom -> ClassroomPost`

- many-to-many style:
  - faculty assignment uses `facultyIds[]`
  - curriculum semesters use `subjects[]`
  - classroom membership is modeled through `ClassroomMember`

### Indexing and optimization

Important indexes already in code:

- unique email on `User`
- unique register number on `Student`
- unique employee ID on `Faculty`
- unique department + regulation on `Curriculum`
- unique subject code per department + regulation
- unique faculty assignment per component + section + year + semester
- unique timetable per section + year + semester
- unique attendance per classroom + timetableEntry + date

Why it matters:

- prevents duplicate academic setup
- improves dashboard and lookup performance
- protects attendance and timetable from accidental duplication

## 9. Security and Production Readiness

### Present in the current code

- JWT-based authentication
- bcrypt password hashing
- role-based authorization
- inactive-user blocking
- schema validation and duplicate checks
- upload middleware
- global error handling

### Production concerns to review

- `cors("*")` is too open for production and should be restricted
- login and password reset should be rate-limited
- upload limits and MIME checks can be tightened further
- secrets must come from environment variables only
- background mail retry strategy would improve reliability

### Recommended production additions

- `helmet`
- request rate limiting
- structured logging
- request validation layer
- audit logs for admin/HOD changes
- stronger auth/session strategy if the app scales

## 10. Error Handling Strategy

### Components

- `AppError`
  - marks known operational errors with status code and optional details

- `catchAsync`
  - wraps async controllers and forwards errors automatically

- `globalErrorHandler`
  - final error response formatter

### Response shape

Typical error response:

```json
{
  "success": false,
  "status": "fail",
  "message": "Readable error message",
  "data": {}
}
```

### Strategy

- development mode returns more detail, stack traces, and diagnostic objects
- production mode returns safer operational messages
- unexpected internal failures collapse into generic `Something went wrong!`

## 11. Setup and Run

### Requirements

- Node.js 18+
- MongoDB

### Expected environment variables

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/lms
JWT_SECRET=replace-with-strong-secret
FRONTEND_URL=http://localhost:5173
APP_TIMEZONE=Asia/Kolkata
NODE_ENV=development
```

Mail flows also need SMTP settings used by `sendEmail`.

### Commands

```bash
npm install
npm run dev
npm start
npm test
```

### Runtime entry points

- `server.js`: starts server and database connection
- `app.js`: configures middleware, routes, docs, and errors

### API docs

- `/api-docs`

## 12. Backend Mental Model

The easiest way to understand this backend is to follow the academic lifecycle:

- admin defines the academic structure
- HOD converts it into a departmental teaching plan
- backend creates classrooms from those allocations
- faculty teaches and records attendance
- students participate and submit work

The real backbone is:

```text
Department
  + Batch
  + Regulation
  -> BatchProgram
  -> Section
  -> Curriculum
  -> Subjects
  -> Faculty Assignment
  -> Timetable
  -> Classroom
  -> Attendance and course delivery
```

Once that chain is clear, the purpose of each controller and model becomes much easier to follow.
