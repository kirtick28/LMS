import jwt from 'jsonwebtoken';
import request from 'supertest';

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

  test('student schema should not define its own isActive field', () => {
    expect(Student.schema.path('isActive')).toBeUndefined();
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
