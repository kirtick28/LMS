import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import xlsx from 'xlsx';

import app from '../app.js';
import AcademicYear from '../models/AcademicYear.js';
import Batch from '../models/Batch.js';
import BatchProgram from '../models/BatchProgram.js';
import Department from '../models/Department.js';
import Regulation from '../models/Regulation.js';
import Section from '../models/Section.js';
import Student from '../models/Student.js';
import StudentAcademicRecord from '../models/StudentAcademicRecord.js';
import User from '../models/User.js';

describe('Student API', () => {
  let seq = 0;
  const uniq = () => `${Date.now()}-${++seq}`;

  const createUser = async (overrides = {}) => {
    return await User.create({
      email: overrides.email || `user-${uniq()}@example.com`,
      password: overrides.password || 'password123',
      role: overrides.role || 'ADMIN',
      isActive:
        typeof overrides.isActive === 'boolean' ? overrides.isActive : true,
      gender: overrides.gender
    });
  };

  const createToken = (user) =>
    jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

  const createAdminToken = async () => createToken(await createUser());
  const createFacultyToken = async () =>
    createToken(await createUser({ role: 'FACULTY' }));

  const createAcademicContext = async (overrides = {}) => {
    const suffix = uniq();
    const yearSeed = 2020 + (seq % 20);
    const startYear = overrides.startYear || yearSeed;
    const endYear = overrides.endYear || startYear + 4;
    const [department, batch, regulation] = await Promise.all([
      Department.create({
        name: overrides.departmentName || `CSE-${suffix}`,
        code: overrides.departmentCode || `C${suffix.slice(-5)}`
      }),
      Batch.create({
        startYear,
        endYear,
        name: overrides.batchName || `${startYear}-${endYear}-${suffix}`
      }),
      Regulation.create({
        name: overrides.regulationName || `R${suffix.slice(-4)}`,
        startYear
      })
    ]);

    const batchProgram = await BatchProgram.create({
      batchId: batch._id,
      departmentId: department._id,
      regulationId: regulation._id
    });

    const [sectionA, sectionB, academicYear] = await Promise.all([
      Section.create({
        name: 'A',
        batchProgramId: batchProgram._id,
        capacity: 60
      }),
      Section.create({
        name: 'B',
        batchProgramId: batchProgram._id,
        capacity: 60
      }),
      AcademicYear.create({
        name: `AY-${suffix}`,
        startYear: overrides.academicStartYear || 2025,
        endYear: overrides.academicEndYear || 2026,
        isActive: true
      })
    ]);

    return {
      department,
      batch,
      regulation,
      batchProgram,
      sectionA,
      sectionB,
      academicYear
    };
  };

  const createStudentWithRecord = async (context, overrides = {}) => {
    const user = await User.create({
      email: overrides.email || `student-${uniq()}@example.com`,
      password: 'password123',
      role: 'STUDENT',
      isActive:
        typeof overrides.userIsActive === 'boolean'
          ? overrides.userIsActive
          : true,
      gender: overrides.gender || 'Male'
    });

    const student = await Student.create({
      userId: user._id,
      departmentId: overrides.departmentId || context.department._id,
      batchId: overrides.batchId || context.batch._id,
      sectionId: overrides.sectionId || context.sectionA._id,
      firstName: overrides.firstName || 'Test',
      lastName: overrides.lastName || 'Student',
      registerNumber: overrides.registerNumber || `REG-${uniq()}`,
      rollNumber: overrides.rollNumber || `ROLL-${uniq()}`,
      semesterNumber: overrides.semesterNumber || 1,
      status: overrides.status || 'active'
    });

    if (overrides.createRecord !== false) {
      await StudentAcademicRecord.create({
        studentId: student._id,
        academicYearId: overrides.academicYearId || context.academicYear._id,
        semesterNumber: overrides.recordSemester || student.semesterNumber,
        sectionId: overrides.recordSectionId || student.sectionId,
        status: overrides.recordStatus || 'active'
      });
    }

    return { user, student };
  };

  const withMockedTransactionSession = () => {
    let originalStartSession;

    beforeEach(() => {
      originalStartSession = mongoose.startSession.bind(mongoose);
      mongoose.startSession = async (...args) => {
        const session = await originalStartSession(...args);
        session.startTransaction = () => {};
        session.commitTransaction = async () => {};
        session.abortTransaction = async () => {};
        return session;
      };
    });

    afterEach(() => {
      mongoose.startSession = originalStartSession;
    });
  };

  test('student schema should not define its own isActive field', () => {
    expect(Student.schema.path('isActive')).toBeUndefined();
  });

  describe('POST /api/students', () => {
    withMockedTransactionSession();

    test('should create a student and return studentId', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext({
        startYear: 2024,
        endYear: 2028,
        academicStartYear: 2025,
        academicEndYear: 2026
      });

      const payload = {
        email: `fresh-${uniq()}@example.com`,
        password: 'password123',
        firstName: 'Fresh',
        lastName: 'Student',
        registerNumber: `REG-ADD-${uniq()}`,
        rollNumber: '22CS999',
        semesterNumber: 2,
        gender: 'Male',
        departmentId: context.department._id.toString(),
        batchId: context.batch._id.toString(),
        sectionId: context.sectionA._id.toString()
      };

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Student created successfully');
      expect(res.body.data.studentId).toBeTruthy();

      const createdStudent = await Student.findById(res.body.data.studentId);
      expect(createdStudent).toBeTruthy();
      expect(createdStudent.registerNumber).toBe(payload.registerNumber);

      const createdRecord = await StudentAcademicRecord.findOne({
        studentId: createdStudent._id,
        semesterNumber: 2
      });
      expect(createdRecord).toBeTruthy();
    });

    test('should fail when email already exists', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext({
        startYear: 2024,
        endYear: 2028,
        academicStartYear: 2025,
        academicEndYear: 2026
      });
      const existing = await createUser({ role: 'STUDENT' });

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: existing.email,
          password: 'password123',
          firstName: 'Dup',
          lastName: 'Email',
          registerNumber: `REG-ADD-DUP-${uniq()}`,
          departmentId: context.department._id.toString(),
          batchId: context.batch._id.toString(),
          sectionId: context.sectionA._id.toString()
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('User already exists with this email');
    });
  });

  describe('POST /api/students/upload', () => {
    withMockedTransactionSession();

    test('should fail when file is not provided', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/students/upload')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('No file uploaded');
    });

    test('should upload students from excel and return inserted count', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext({
        startYear: 2024,
        endYear: 2028,
        academicStartYear: 2025,
        academicEndYear: 2026,
        departmentCode: 'UPLD1',
        batchName: '2024-2028-UPLD'
      });

      const workbook = xlsx.utils.book_new();
      const rows = [
        {
          firstName: 'Bulk',
          lastName: 'One',
          registerNumber: `REG-UPL-${uniq()}`,
          rollNumber: 'R1',
          semesterNumber: 1,
          email: `bulk-${uniq()}@example.com`,
          gender: 'Male',
          dateOfBirth: '2005-01-01',
          departmentCode: context.department.code,
          batchName: context.batch.name
        },
        {
          firstName: 'Bulk',
          lastName: 'Two',
          registerNumber: `REG-UPL-${uniq()}`,
          rollNumber: 'R2',
          semesterNumber: 2,
          email: `bulk-${uniq()}@example.com`,
          gender: 'Female',
          dateOfBirth: '2005-02-01',
          departmentCode: context.department.code,
          batchName: context.batch.name
        }
      ];

      const sheet = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, sheet, 'Students');
      const fileBuffer = xlsx.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      });

      const res = await request(app)
        .post('/api/students/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', fileBuffer, 'students.xlsx');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Upload completed successfully');
      expect(res.body.data.inserted).toBe(2);

      const insertedStudents = await Student.find({
        registerNumber: { $in: rows.map((r) => r.registerNumber) }
      });
      expect(insertedStudents).toHaveLength(2);
    });
  });

  describe('PUT /api/students/:id', () => {
    withMockedTransactionSession();

    test('should reject non-admin role', async () => {
      const token = await createFacultyToken();
      const context = await createAcademicContext();
      const { student } = await createStudentWithRecord(context, {
        registerNumber: 'REG-UPD-ROLE-1'
      });

      const res = await request(app)
        .put(`/api/students/${student._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Nope' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail when email is already used by another user', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext();
      const { student } = await createStudentWithRecord(context, {
        registerNumber: 'REG-UPD-DUP-1'
      });
      const takenUser = await createUser({ role: 'STUDENT' });

      const res = await request(app)
        .put(`/api/students/${student._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: takenUser.email });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Email already in use');
    });

    test('should fail for invalid gender value', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext();
      const { student } = await createStudentWithRecord(context, {
        registerNumber: 'REG-UPD-GDR-1'
      });

      const res = await request(app)
        .put(`/api/students/${student._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ gender: 'Unknown' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid gender value');
    });

    test('should fail when isActive is not a boolean', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext();
      const { student } = await createStudentWithRecord(context, {
        registerNumber: 'REG-UPD-ACTIVE-ERR-1'
      });

      const res = await request(app)
        .put(`/api/students/${student._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: 'false' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('isActive must be a boolean value');
    });

    test('should update linked user isActive when provided', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext();
      const { student, user } = await createStudentWithRecord(context, {
        registerNumber: 'REG-UPD-ACTIVE-OK-1',
        userIsActive: true
      });

      const res = await request(app)
        .put(`/api/students/${student._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isActive).toBe(false);
    });

    test('should update linked user fields and student fields together', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext();
      const { student, user } = await createStudentWithRecord(context, {
        registerNumber: 'REG-UPD-OK-1',
        firstName: 'Before',
        lastName: 'User',
        gender: 'Male'
      });

      const payload = {
        firstName: 'After',
        email: `updated-${uniq()}@example.com`,
        password: 'newpass123',
        gender: 'Female',
        dateOfBirth: '2004-08-15'
      };

      const res = await request(app)
        .put(`/api/students/${student._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Student updated successfully');
      expect(res.body.data.student.firstName).toBe('After');

      const [updatedStudent, updatedUser] = await Promise.all([
        Student.findById(student._id),
        User.findById(user._id).select('+password')
      ]);

      expect(updatedStudent.firstName).toBe('After');
      expect(updatedUser.email).toBe(payload.email.toLowerCase());
      expect(updatedUser.gender).toBe('Female');
      expect(new Date(updatedUser.dateOfBirth).toISOString()).toBe(
        '2004-08-15T00:00:00.000Z'
      );
      await expect(updatedUser.comparePassword('newpass123')).resolves.toBe(
        true
      );
    });
  });

  describe('DELETE /api/students/:id', () => {
    test('should fail with invalid student id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/students/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid student ID');
    });

    test('should return 404 when student does not exist', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/students/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Student not found');
    });

    test('should deactivate linked user and remove student + academic records', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext();
      const { user, student } = await createStudentWithRecord(context, {
        registerNumber: 'REGDEL001',
        firstName: 'Delete',
        lastName: 'Me'
      });

      const res = await request(app)
        .delete(`/api/students/${student._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Student deleted successfully');

      const [deletedStudent, userAfter, recordsAfter] = await Promise.all([
        Student.findById(student._id),
        User.findById(user._id),
        StudentAcademicRecord.find({ studentId: student._id })
      ]);

      expect(deletedStudent).toBeNull();
      expect(userAfter).toBeTruthy();
      expect(userAfter.isActive).toBe(false);
      expect(recordsAfter).toHaveLength(0);
    });
  });

  describe('GET /api/students', () => {
    test('should fail without token', async () => {
      const res = await request(app).get('/api/students');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should return students for authenticated user', async () => {
      const token = await createFacultyToken();
      const context = await createAcademicContext();
      await createStudentWithRecord(context, {
        firstName: 'Alice',
        lastName: 'Wonder',
        registerNumber: 'REG-GET-1',
        semesterNumber: 2
      });

      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Students fetched successfully');
      expect(res.body.data.students).toHaveLength(1);
      expect(res.body.data.students[0].firstName).toBe('Alice');
      expect(res.body.data.students[0].userId.email).toContain('student-');
    });

    test('should filter by departmentId, sectionId, status and semesterNumber', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext();

      await createStudentWithRecord(context, {
        registerNumber: 'REG-FLT-1',
        semesterNumber: 3,
        status: 'active',
        sectionId: context.sectionA._id
      });
      await createStudentWithRecord(context, {
        registerNumber: 'REG-FLT-2',
        semesterNumber: 3,
        status: 'graduated',
        sectionId: context.sectionA._id
      });

      const res = await request(app)
        .get(
          `/api/students?departmentId=${context.department._id}&sectionId=${context.sectionA._id}&status=active&semesterNumber=3`
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(1);
      expect(res.body.data.students[0].registerNumber).toBe('REG-FLT-1');
    });

    test('should return aggregate academic-year view when academicYearId is passed', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext();
      await createStudentWithRecord(context, {
        registerNumber: 'REG-AY-1',
        semesterNumber: 1,
        recordSemester: 1,
        sectionId: context.sectionB._id,
        recordSectionId: context.sectionB._id
      });

      const res = await request(app)
        .get(`/api/students?academicYearId=${context.academicYear._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(1);
      expect(res.body.data.students[0].academicYear.name).toBe(
        context.academicYear.name
      );
      expect(res.body.data.students[0].yearLevel).toBe(1);
      expect(res.body.data.students[0].section.name).toBe('B');
    });

    test('should fail for invalid query object id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/students?departmentId=bad-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid departmentId format');
    });
  });

  describe('POST /api/students/semester-shift', () => {
    withMockedTransactionSession();

    test('should fail when departmentId or batchId is missing', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/students/semester-shift')
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId: new mongoose.Types.ObjectId().toString() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('departmentId and batchId are required');
    });

    test('should promote matching active students within same academic year', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext({
        startYear: 2024,
        endYear: 2028,
        academicStartYear: 2025,
        academicEndYear: 2026
      });

      const s1 = await createStudentWithRecord(context, {
        registerNumber: 'REG-SHIFT-ODD-1',
        semesterNumber: 1,
        createRecord: false
      });
      const s2 = await createStudentWithRecord(context, {
        registerNumber: 'REG-SHIFT-ODD-2',
        semesterNumber: 1,
        createRecord: false
      });

      const res = await request(app)
        .post('/api/students/semester-shift')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: context.department._id.toString(),
          batchId: context.batch._id.toString()
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Semester shift completed successfully');
      expect(res.body.data.studentsPromoted).toBe(2);
      expect(res.body.data.studentsGraduated).toBe(0);
      expect(res.body.data.academicYearChanged).toBe(false);

      const updatedStudents = await Student.find({
        _id: { $in: [s1.student._id, s2.student._id] }
      });
      expect(updatedStudents.every((s) => s.semesterNumber === 2)).toBe(true);

      const insertedRecords = await StudentAcademicRecord.find({
        studentId: { $in: [s1.student._id, s2.student._id] },
        semesterNumber: 2,
        academicYearId: context.academicYear._id
      });
      expect(insertedRecords).toHaveLength(2);
    });

    test('should move to next academic year for even-to-odd transition', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext({
        startYear: 2024,
        endYear: 2028,
        academicStartYear: 2025,
        academicEndYear: 2026
      });

      await createStudentWithRecord(context, {
        registerNumber: 'REG-SHIFT-EVEN-1',
        semesterNumber: 2,
        createRecord: false
      });

      const res = await request(app)
        .post('/api/students/semester-shift')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: context.department._id.toString(),
          batchId: context.batch._id.toString()
        });

      expect(res.status).toBe(200);
      expect(res.body.data.academicYearChanged).toBe(true);
      expect(res.body.data.academicYear).toBe('2026-27');

      const [currentYear, nextYear] = await Promise.all([
        AcademicYear.findById(context.academicYear._id),
        AcademicYear.findOne({ startYear: 2026 })
      ]);

      expect(currentYear.isActive).toBe(false);
      expect(nextYear).toBeTruthy();
      expect(nextYear.isActive).toBe(true);
    });
  });

  describe('GET /api/students/stats/year-wise', () => {
    test('should fail without token', async () => {
      const res = await request(app).get('/api/students/stats/year-wise');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should return year-wise totals from Student collection', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext();

      await createStudentWithRecord(context, {
        registerNumber: 'REG-STATS-1',
        semesterNumber: 1,
        createRecord: false
      });
      await createStudentWithRecord(context, {
        registerNumber: 'REG-STATS-2',
        semesterNumber: 4,
        createRecord: false
      });
      await createStudentWithRecord(context, {
        registerNumber: 'REG-STATS-3',
        semesterNumber: 7,
        createRecord: false
      });

      const res = await request(app)
        .get('/api/students/stats/year-wise')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalStudents).toBe(3);
      expect(res.body.data.yearWise.firstYear).toBe(1);
      expect(res.body.data.yearWise.secondYear).toBe(1);
      expect(res.body.data.yearWise.fourthYear).toBe(1);
    });

    test('should return year-wise totals from academic records when academicYearId is provided', async () => {
      const token = await createAdminToken();
      const context = await createAcademicContext();

      await createStudentWithRecord(context, {
        registerNumber: 'REG-STATS-AY1',
        semesterNumber: 2,
        recordSemester: 2
      });
      await createStudentWithRecord(context, {
        registerNumber: 'REG-STATS-AY2',
        semesterNumber: 5,
        recordSemester: 5
      });

      const res = await request(app)
        .get(
          `/api/students/stats/year-wise?academicYearId=${context.academicYear._id}`
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalStudents).toBe(2);
      expect(res.body.data.yearWise.firstYear).toBe(1);
      expect(res.body.data.yearWise.thirdYear).toBe(1);
    });
  });

  describe('GET /api/students/stats/department-wise', () => {
    test('should return department-wise totals', async () => {
      const token = await createAdminToken();
      const contextA = await createAcademicContext({
        departmentName: 'Dept-A',
        departmentCode: 'DPTA'
      });
      const contextB = await createAcademicContext({
        departmentName: 'Dept-B',
        departmentCode: 'DPTB'
      });

      await createStudentWithRecord(contextA, {
        registerNumber: 'REG-DPT-1',
        semesterNumber: 1,
        createRecord: false
      });
      await createStudentWithRecord(contextA, {
        registerNumber: 'REG-DPT-2',
        semesterNumber: 4,
        createRecord: false
      });
      await createStudentWithRecord(contextB, {
        registerNumber: 'REG-DPT-3',
        semesterNumber: 7,
        createRecord: false
      });

      const res = await request(app)
        .get('/api/students/stats/department-wise')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalDepartments).toBe(2);

      const deptA = res.body.data.departments.find(
        (d) => d.departmentName === 'Dept-A'
      );
      expect(deptA.totalStudents).toBe(2);
    });

    test('should fail for invalid departmentId query', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/students/stats/department-wise?departmentId=bad-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid departmentId format');
    });
  });
});
