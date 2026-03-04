import request from 'supertest';
import xlsx from 'xlsx';
import app from '../app.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Batch from '../models/Batch.js';
import Section from '../models/Section.js';
import Regulation from '../models/Regulation.js';

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
  startYear: 2024,
  endYear: 2028,
  departmentName: 'Computer Science and Engineering',
  departmentCode: 'CSE',
  regulationStartYear: 2024,
  ...overrides
});

describe('Student API', () => {
  describe('Auth and access control', () => {
    it('rejects create student without token', async () => {
      const res = await request(app)
        .post('/api/students')
        .send(createStudentPayload());
      expect(res.statusCode).toBe(401);
    });

    it('rejects create student for non-admin role', async () => {
      const token = await getTokenByRole('FACULTY', 'faculty-student-create');

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(createStudentPayload());

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });
  });

  describe('Create student', () => {
    it('creates student and auto-creates department, regulation, batch, UNALLOCATED section', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-student-create');

      const payload = createStudentPayload({
        email: 'student-create@example.com',
        registerNumber: 'REG1001'
      });

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.statusCode).toBe(201);

      const student = await Student.findById(res.body.student._id);
      const user = await User.findById(student.userId);
      const section = await Section.findById(student.sectionId);
      const batch = await Batch.findById(student.batchId);
      const regulation = await Regulation.findById(batch.regulationId);
      const department = await Department.findById(student.departmentId);

      expect(student).toBeTruthy();
      expect(user).toBeTruthy();
      expect(section.name).toBe('UNALLOCATED');
      expect(batch.startYear).toBe(2024);
      expect(batch.endYear).toBe(2028);
      expect(regulation.startYear).toBe(2024);
      expect(department.code).toBe('CSE');
      expect(student.academicYear.startYear).toBe(2024);
      expect(student.academicYear.endYear).toBe(2025);
      expect(student.academicYear.name).toBe('24 - 25');
    });

    it('returns 400 for duplicate registerNumber', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-student-dup-reg');

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'reg-dup-1@example.com',
            registerNumber: 'REG2001'
          })
        );

      const second = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'reg-dup-2@example.com',
            registerNumber: 'reg2001'
          })
        );

      expect(second.statusCode).toBe(400);
      expect(second.body.message).toBe('Register Number already exists');
    });

    it('returns 400 when batch year range is missing for auto-create flow', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-student-no-years');

      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'missing-years@example.com',
            registerNumber: 'REG3001',
            startYear: undefined,
            endYear: undefined
          })
        );

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/startYear|endYear/i);
    });
  });

  describe('Get, update, delete and stats', () => {
    it('filters GET /api/students by sectionId', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-student-filter');

      const created = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'filter1@example.com',
            registerNumber: 'REG4001'
          })
        );

      const student = await Student.findById(created.body.student._id);

      const res = await request(app)
        .get(`/api/students?sectionId=${student.sectionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });

    it('updates semester and recalculates academic year', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-student-semester');

      const created = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'semester-change@example.com',
            registerNumber: 'REG4101',
            startYear: 2023,
            endYear: 2027,
            semesterNumber: 2
          })
        );

      expect(created.statusCode).toBe(201);

      const updateRes = await request(app)
        .patch(`/api/students/${created.body.student._id}/semester`)
        .set('Authorization', `Bearer ${token}`)
        .send({ semesterNumber: 5 });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.student.semesterNumber).toBe(5);
      expect(updateRes.body.student.academicYear.startYear).toBe(2025);
      expect(updateRes.body.student.academicYear.endYear).toBe(2026);
      expect(updateRes.body.student.academicYear.name).toBe('25 - 26');
    });

    it('filters GET /api/students by academic year name', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-student-ay-filter');

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'ay-filter-1@example.com',
            registerNumber: 'REG4201',
            startYear: 2023,
            endYear: 2027,
            semesterNumber: 5
          })
        );

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'ay-filter-2@example.com',
            registerNumber: 'REG4202',
            startYear: 2023,
            endYear: 2027,
            semesterNumber: 1
          })
        );

      const res = await request(app)
        .get('/api/students?academicYearName=25%20-%2026')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].academicYear.name).toBe('25 - 26');
    });

    it('returns 400 when update gets invalid student id', async () => {
      const token = await getTokenByRole(
        'ADMIN',
        'admin-student-update-bad-id'
      );

      const res = await request(app)
        .put('/api/students/not-a-valid-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'X' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Invalid student id');
    });

    it('returns 404 for deleting non-existing student', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-student-delete-404');

      const res = await request(app)
        .delete(`/api/students/${new Section()._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Student not found');
    });

    it('returns year-wise and department-wise stats', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-student-stats');

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'stats-s1@example.com',
            registerNumber: 'REG5001',
            semesterNumber: 1,
            departmentName: 'ECE',
            departmentCode: 'ECE'
          })
        );

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .send(
          createStudentPayload({
            email: 'stats-s2@example.com',
            registerNumber: 'REG5002',
            semesterNumber: 5,
            departmentName: 'ECE',
            departmentCode: 'ECE'
          })
        );

      const [yearWise, deptWise] = await Promise.all([
        request(app)
          .get('/api/students/stats/year-wise')
          .set('Authorization', `Bearer ${token}`),
        request(app)
          .get('/api/students/stats/department-wise')
          .set('Authorization', `Bearer ${token}`)
      ]);

      expect(yearWise.statusCode).toBe(200);
      expect(yearWise.body.totalStudents).toBe(2);
      expect(yearWise.body.yearWise.firstYear).toBe(1);
      expect(yearWise.body.yearWise.thirdYear).toBe(1);

      expect(deptWise.statusCode).toBe(200);
      expect(deptWise.body.totalDepartments).toBe(1);
      expect(deptWise.body.departments[0].totalStudents).toBe(2);
    });
  });

  describe('Bulk upload', () => {
    it('returns 400 when file is missing', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-student-upload-400');

      const res = await request(app)
        .post('/api/students/upload')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('No file uploaded');
    });

    it('uploads students and reports skipped/failed rows', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-student-upload-200');

      const rows = [
        {
          email: 'bulk-student-1@example.com',
          firstName: 'A',
          lastName: 'One',
          registerNumber: 'BREG1',
          startYear: 2023,
          endYear: 2027,
          departmentName: 'IT',
          departmentCode: 'IT',
          regulationStartYear: 2023,
          semesterNumber: 1
        },
        {
          email: 'bulk-student-1@example.com',
          firstName: 'A2',
          lastName: 'One2',
          registerNumber: 'BREG2',
          startYear: 2023,
          endYear: 2027,
          departmentName: 'IT',
          departmentCode: 'IT',
          regulationStartYear: 2023,
          semesterNumber: 1
        },
        {
          email: 'bulk-student-3@example.com',
          firstName: 'Broken'
        }
      ];

      const workbook = xlsx.utils.book_new();
      const sheet = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, sheet, 'Students');
      const excelBuffer = xlsx.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      });

      const res = await request(app)
        .post('/api/students/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', excelBuffer, 'students-upload.xlsx');

      expect(res.statusCode).toBe(200);
      expect(res.body.inserted).toBe(1);
      expect(res.body.skipped).toBe(1);
      expect(res.body.failed).toBe(1);
    });
  });
});
