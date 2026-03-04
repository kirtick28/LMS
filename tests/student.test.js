import request from 'supertest';
import app from '../app.js';
import Student from '../models/Student.js';
import Department from '../models/Department.js';
import AcademicYear from '../models/AcademicYear.js';
import Batch from '../models/Batch.js';
import Section from '../models/Section.js';
import mongoose from 'mongoose';

let seq = 0;
const uniqueId = () => `${Date.now()}-${++seq}`;

const getTokenByRole = async (role, emailPrefix = 'user') => {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      email: `${emailPrefix}-${uniqueId()}@example.com`,
      password: '123456',
      role
    });

  return registerRes.body.data.token;
};

const createStudentPayload = (overrides = {}) => ({
  email: `student-${uniqueId()}@example.com`,
  password: '123456',
  firstName: 'John',
  lastName: 'Doe',
  registerNumber: `REG${uniqueId()}`,
  departmentName: 'Computer Science and Engineering',
  departmentCode: 'CSE',
  academicYearName: '2026-2027',
  semesterNumber: 1,
  ...overrides
});

describe('Student API', () => {
  describe('Auth and access control', () => {
    it('rejects create student without token', async () => {
      const res = await request(app)
        .post('/api/students')
        .send(createStudentPayload());

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBeDefined();
    });

    it('rejects create student for non-admin role', async () => {
      const studentToken = await getTokenByRole('STUDENT', 'student-role');

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(createStudentPayload());

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    it('allows protected read endpoint with valid token', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-list');

      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Create student', () => {
    it('creates student by auto-creating academic context with UNALLOCATED section', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-create-1');

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'student1@example.com',
            registerNumber: 'REG001'
          })
        );

      expect(res.statusCode).toBe(201);

      const [departmentCount, academicYearCount, batchCount, sectionCount] =
        await Promise.all([
          Department.countDocuments(),
          AcademicYear.countDocuments(),
          Batch.countDocuments(),
          Section.countDocuments({ name: 'UNALLOCATED' })
        ]);

      expect(departmentCount).toBe(1);
      expect(academicYearCount).toBe(1);
      expect(batchCount).toBe(1);
      expect(sectionCount).toBe(1);

      const student = await Student.findOne({ registerNumber: 'REG001' })
        .populate('departmentId')
        .populate('batchId')
        .populate('academicHistory.academicYearId')
        .populate('academicHistory.sectionId');

      expect(student).toBeTruthy();
      expect(student.academicHistory[0].sectionId.name).toBe('UNALLOCATED');
      expect(student.academicHistory[0].isCurrent).toBe(true);
      expect(student.academicHistory[0].semesterNumber).toBe(1);
    });

    it('reuses same department/academicYear/batch/section for another student', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-create-2');

      const first = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'student2@example.com',
            firstName: 'Alice',
            lastName: 'Ray',
            registerNumber: 'REG002',
            departmentName: 'Information Technology',
            departmentCode: 'IT',
            academicYearName: '2025-2026'
          })
        );

      expect(first.statusCode).toBe(201);

      const firstStudent = await Student.findOne({ registerNumber: 'REG002' });

      const second = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'student3@example.com',
            firstName: 'Bob',
            lastName: 'Lee',
            registerNumber: 'REG003',
            departmentName: 'Information Technology',
            departmentCode: 'IT',
            academicYearName: '2025-2026'
          })
        );

      expect(second.statusCode).toBe(201);

      const secondStudent = await Student.findOne({ registerNumber: 'REG003' });

      expect(firstStudent.departmentId.toString()).toBe(
        secondStudent.departmentId.toString()
      );
      expect(firstStudent.batchId.toString()).toBe(
        secondStudent.batchId.toString()
      );
      expect(firstStudent.academicHistory[0].academicYearId.toString()).toBe(
        secondStudent.academicHistory[0].academicYearId.toString()
      );
      expect(firstStudent.academicHistory[0].sectionId.toString()).toBe(
        secondStudent.academicHistory[0].sectionId.toString()
      );

      const [departmentCount, academicYearCount, batchCount, sectionCount] =
        await Promise.all([
          Department.countDocuments(),
          AcademicYear.countDocuments(),
          Batch.countDocuments(),
          Section.countDocuments({ name: 'UNALLOCATED' })
        ]);

      expect(departmentCount).toBe(1);
      expect(academicYearCount).toBe(1);
      expect(batchCount).toBe(1);
      expect(sectionCount).toBe(1);
    });

    it('returns 400 when required student fields are missing', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-missing-fields');

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'missing@example.com',
          password: '123456'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('required');
    });

    it('returns 400 for duplicate registerNumber', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-dup-reg');

      const firstPayload = createStudentPayload({
        email: 'dup-reg-1@example.com',
        registerNumber: 'DUPREG001'
      });

      const secondPayload = createStudentPayload({
        email: 'dup-reg-2@example.com',
        registerNumber: 'DUPREG001'
      });

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(firstPayload);

      const secondRes = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(secondPayload);

      expect(secondRes.statusCode).toBe(400);
      expect(secondRes.body.message).toBe('Register Number already exists');
    });

    it('uses current academic year when academicYear details are not provided', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-current-year');

      const currentYear = await AcademicYear.create({
        name: '2030-2031',
        startYear: 2030,
        endYear: 2031,
        isCurrent: true,
        isActive: true
      });

      const payload = createStudentPayload({
        email: 'current-year@example.com',
        registerNumber: 'CURR001',
        academicYearName: undefined,
        startYear: undefined,
        endYear: undefined
      });

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.statusCode).toBe(201);

      const student = await Student.findOne({ registerNumber: 'CURR001' });
      expect(student.academicHistory[0].academicYearId.toString()).toBe(
        currentYear._id.toString()
      );
    });

    it('returns 500 for invalid departmentId supplied', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-invalid-dept');

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            departmentId: new mongoose.Types.ObjectId().toString(),
            departmentName: undefined
          })
        );

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe('Invalid departmentId');
    });
  });

  describe('Other student endpoints', () => {
    it('returns 404 when updating non-existing student', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-update-404');

      const res = await request(app)
        .put(`/api/students/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Updated' });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Student not found');
    });

    it('returns 404 when deleting non-existing student', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-delete-404');

      const res = await request(app)
        .delete(`/api/students/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Student not found');
    });

    it('returns 400 when swap-section receives no studentIds', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-swap-400');

      const res = await request(app)
        .post('/api/students/swap-section')
        .set('Authorization', `Bearer ${token}`)
        .send({ studentIds: [] });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('No students selected');
    });

    it('returns 400 for upload endpoint when file is missing', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-upload-400');

      const res = await request(app)
        .post('/api/students/upload')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('No file uploaded');
    });

    it('filters GET /api/students by academicYearId', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-list-academic-year');

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'ay-2025-a@example.com',
            registerNumber: 'AY2025A',
            academicYearName: '2025-2026',
            semesterNumber: 1
          })
        );

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'ay-2024-a@example.com',
            registerNumber: 'AY2024A',
            academicYearName: '2024-2025',
            semesterNumber: 1
          })
        );

      const ay2025 = await AcademicYear.findOne({ name: '2025-2026' });

      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .query({ academicYearId: ay2025._id.toString() });

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].registerNumber).toBe('AY2025A');
      expect(res.body[0].academicHistory.length).toBe(1);
      expect(
        String(
          res.body[0].academicHistory[0].academicYearId?._id ||
            res.body[0].academicHistory[0].academicYearId
        )
      ).toBe(ay2025._id.toString());
    });

    it('returns year-wise stats for specific academic year', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-stats-academic-year');

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'stats-ay-y1@example.com',
            registerNumber: 'STATSY1',
            academicYearName: '2025-2026',
            semesterNumber: 1
          })
        );

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'stats-ay-y2@example.com',
            registerNumber: 'STATSY2',
            academicYearName: '2025-2026',
            semesterNumber: 3
          })
        );

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'stats-ay-other@example.com',
            registerNumber: 'STATSOT',
            academicYearName: '2024-2025',
            semesterNumber: 5
          })
        );

      const ay2025 = await AcademicYear.findOne({ name: '2025-2026' });

      const res = await request(app)
        .get('/api/students/stats/year-wise')
        .set('Authorization', `Bearer ${token}`)
        .query({ academicYearId: ay2025._id.toString() });

      expect(res.statusCode).toBe(200);
      expect(res.body.totalStudents).toBe(2);
      expect(res.body.yearWise.firstYear).toBe(1);
      expect(res.body.yearWise.secondYear).toBe(1);
      expect(res.body.yearWise.thirdYear).toBe(0);
      expect(res.body.yearWise.fourthYear).toBe(0);
    });

    it('returns department-wise year split for specific academic year', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-stats-deptwise');

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'dept-cse-y1@example.com',
            registerNumber: 'DCSEY1',
            departmentName: 'Computer Science and Engineering',
            departmentCode: 'CSE',
            academicYearName: '2026-2027',
            semesterNumber: 1
          })
        );

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'dept-ece-y2@example.com',
            registerNumber: 'DECEY2',
            departmentName: 'Electronics and Communication Engineering',
            departmentCode: 'ECE',
            academicYearName: '2026-2027',
            semesterNumber: 3
          })
        );

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'dept-cse-old@example.com',
            registerNumber: 'DCSEOLD',
            departmentName: 'Computer Science and Engineering',
            departmentCode: 'CSE',
            academicYearName: '2025-2026',
            semesterNumber: 5
          })
        );

      const ay = await AcademicYear.findOne({ name: '2026-2027' });

      const res = await request(app)
        .get('/api/students/stats/department-wise')
        .set('Authorization', `Bearer ${token}`)
        .query({ academicYearId: ay._id.toString() });

      expect(res.statusCode).toBe(200);
      expect(res.body.totalDepartments).toBe(2);

      const cse = res.body.departments.find(
        (departmentRow) =>
          departmentRow.department === 'Computer Science and Engineering'
      );
      const ece = res.body.departments.find(
        (departmentRow) =>
          departmentRow.department ===
          'Electronics and Communication Engineering'
      );

      expect(cse.totalStudents).toBe(1);
      expect(cse.yearWise.firstYear).toBe(1);
      expect(ece.totalStudents).toBe(1);
      expect(ece.yearWise.secondYear).toBe(1);
    });

    it('returns 404 for removed legacy endpoint /api/students/department-summary', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-legacy-summary');

      const res = await request(app)
        .get('/api/students/department-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
    });
  });
});
