import request from 'supertest';
import xlsx from 'xlsx';
import mongoose from 'mongoose';
import app from '../app.js';
import Faculty from '../models/Faculty.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Batch from '../models/Batch.js';
import Regulation from '../models/Regulation.js';
import BatchProgram from '../models/BatchProgram.js';
import Section from '../models/Section.js';

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

const createFacultyPayload = (overrides = {}) => ({
  email: `faculty-${uniqueId()}@example.com`,
  password: '123456',
  firstName: 'Anand',
  lastName: 'K',
  mobileNumber: '9876543210',
  employeeId: `EMP${uniqueId()}`,
  designation: 'Assistant Professor',
  departmentName: 'Computer Science and Engineering',
  departmentCode: 'CSE',
  ...overrides
});

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

describe('User Roles API: Faculty and Student', () => {
  describe('Faculty API', () => {
    describe('Auth and role guard', () => {
      it('rejects create faculty without token', async () => {
        const res = await request(app)
          .post('/api/faculty')
          .send(createFacultyPayload());

        expect(res.statusCode).toBe(401);
      });

      it('rejects create faculty for non-admin role', async () => {
        const facultyToken = await getTokenByRole('FACULTY', 'faculty-role');

        const res = await request(app)
          .post('/api/faculty')
          .set('Authorization', `Bearer ${facultyToken}`)
          .send(createFacultyPayload());

        expect(res.statusCode).toBe(403);
      });
    });

    describe('Create faculty', () => {
      it('creates linked user/faculty and auto-creates department', async () => {
        const adminToken = await getTokenByRole(
          'ADMIN',
          'admin-faculty-create'
        );
        const payload = createFacultyPayload({
          email: 'faculty-create@example.com',
          employeeId: 'EMP1001'
        });

        const res = await request(app)
          .post('/api/faculty')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);

        const user = await User.findOne({ email: payload.email });
        const faculty = await Faculty.findOne({
          employeeId: payload.employeeId
        });
        const department = await Department.findOne({
          name: 'Computer Science and Engineering'
        });

        expect(user).toBeTruthy();
        expect(user.role).toBe('FACULTY');
        expect(faculty).toBeTruthy();
        expect(faculty.userId.toString()).toBe(user._id.toString());
        expect(department).toBeTruthy();
      });

      it('returns 400 for duplicate employeeId', async () => {
        const adminToken = await getTokenByRole('ADMIN', 'admin-faculty-dup');

        await request(app)
          .post('/api/faculty')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(
            createFacultyPayload({
              email: 'dup-1@example.com',
              employeeId: 'EMP2001'
            })
          );

        const secondRes = await request(app)
          .post('/api/faculty')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(
            createFacultyPayload({
              email: 'dup-2@example.com',
              employeeId: 'EMP2001'
            })
          );

        expect(secondRes.statusCode).toBe(400);
        expect(secondRes.body.success).toBe(false);
      });
    });

    describe('Update and delete faculty', () => {
      it('updates faculty and linked user fields', async () => {
        const adminToken = await getTokenByRole(
          'ADMIN',
          'admin-faculty-update'
        );

        const createRes = await request(app)
          .post('/api/faculty')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(
            createFacultyPayload({
              email: 'faculty-update@example.com',
              employeeId: 'EMP3001'
            })
          );

        const facultyId = createRes.body.data.faculty._id;

        const updateRes = await request(app)
          .put(`/api/faculty/${facultyId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'faculty-update-new@example.com',
            password: 'newpass123',
            firstName: 'Updated',
            designation: 'HOD',
            phone: '9999999999'
          });

        expect(updateRes.statusCode).toBe(200);
        expect(updateRes.body.success).toBe(true);
        expect(updateRes.body.data.faculty.firstName).toBe('Updated');

        const loginRes = await request(app).post('/api/auth/login').send({
          email: 'faculty-update-new@example.com',
          password: 'newpass123'
        });

        expect(loginRes.statusCode).toBe(200);
      });

      it('deletes faculty and linked user', async () => {
        const adminToken = await getTokenByRole(
          'ADMIN',
          'admin-faculty-delete'
        );

        const createRes = await request(app)
          .post('/api/faculty')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(createFacultyPayload());

        const facultyId = createRes.body.data.faculty._id;
        const userId = createRes.body.data.faculty.userId;

        const deleteRes = await request(app)
          .delete(`/api/faculty/${facultyId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(deleteRes.statusCode).toBe(200);
        expect(deleteRes.body.success).toBe(true);

        const [faculty, user] = await Promise.all([
          Faculty.findById(facultyId),
          User.findById(userId)
        ]);

        expect(faculty).toBeNull();
        expect(user).toBeNull();
      });
    });
  });

  describe('Student API', () => {
    describe('Create student', () => {
      it('creates student and auto-resolves new BatchProgram architecture', async () => {
        const token = await getTokenByRole('ADMIN', 'admin-student-create');

        const payload = createStudentPayload({
          email: 'student-newarch@example.com',
          registerNumber: 'REG9999'
        });

        const res = await request(app)
          .post('/api/students')
          .set('Authorization', `Bearer ${token}`)
          .send(payload);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);

        const student = await Student.findById(res.body.data.student._id);
        const section = await Section.findById(student.sectionId);
        const batchProgram = await BatchProgram.findById(
          section.batchProgramId
        );

        expect(student).toBeTruthy();
        expect(batchProgram).toBeTruthy();
        expect(batchProgram.departmentId.toString()).toBe(
          student.departmentId.toString()
        );
        expect(batchProgram.batchId.toString()).toBe(
          student.batchId.toString()
        );
        expect(section.name).toBe('UNALLOCATED');
      });

      it('returns 400 for duplicate registerNumber', async () => {
        const token = await getTokenByRole('ADMIN', 'admin-student-dup-reg');

        await request(app)
          .post('/api/students')
          .set('Authorization', `Bearer ${token}`)
          .send(
            createStudentPayload({
              email: 'reg-dup-11@example.com',
              registerNumber: 'REG2001'
            })
          );

        const second = await request(app)
          .post('/api/students')
          .set('Authorization', `Bearer ${token}`)
          .send(
            createStudentPayload({
              email: 'reg-dup-22@example.com',
              registerNumber: 'reg2001'
            })
          );

        expect(second.statusCode).toBe(400);
        expect(second.body.success).toBe(false);
      });
    });

    describe('Get, update, delete and stats', () => {
      it('filters GET /api/students by batchId', async () => {
        const token = await getTokenByRole('ADMIN', 'admin-student-filter');

        const created = await request(app)
          .post('/api/students')
          .set('Authorization', `Bearer ${token}`)
          .send(createStudentPayload());

        const student = await Student.findById(created.body.data.student._id);

        const res = await request(app)
          .get(`/api/students?batchId=${student.batchId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.students.length).toBeGreaterThanOrEqual(1);
      });

      it('returns 404 for deleting non-existing student', async () => {
        const token = await getTokenByRole('ADMIN', 'admin-student-delete-404');

        const res = await request(app)
          .delete(`/api/students/${new mongoose.Types.ObjectId()}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });
  });
});
