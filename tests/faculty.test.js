import request from 'supertest';
import xlsx from 'xlsx';
import mongoose from 'mongoose';
import app from '../app.js';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import Department from '../models/Department.js';

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
      expect(res.body.message).toBe('Access denied');
    });
  });

  describe('Create faculty', () => {
    it('creates linked user/faculty and auto-creates department', async () => {
      const adminToken = await getTokenByRole('ADMIN', 'admin-faculty-create');
      const payload = createFacultyPayload({
        email: 'faculty-create@example.com',
        employeeId: 'EMP1001'
      });

      const res = await request(app)
        .post('/api/faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Faculty created successfully');

      const user = await User.findOne({ email: payload.email });
      const faculty = await Faculty.findOne({ employeeId: payload.employeeId });
      const department = await Department.findOne({
        name: 'Computer Science and Engineering'
      });

      expect(user).toBeTruthy();
      expect(user.role).toBe('FACULTY');
      expect(user.profileType).toBe('Faculty');
      expect(faculty).toBeTruthy();
      expect(faculty.phone).toBe('9876543210');
      expect(user.profileRef.toString()).toBe(faculty._id.toString());
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
      expect(secondRes.body.message).toMatch(/employeeId/i);
    });

    it('returns 500 for invalid departmentId', async () => {
      const adminToken = await getTokenByRole('ADMIN', 'admin-faculty-invalid');

      const res = await request(app)
        .post('/api/faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          createFacultyPayload({
            departmentId: 'invalid-object-id',
            departmentName: undefined
          })
        );

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe('Invalid departmentId');
    });
  });

  describe('Update and delete faculty', () => {
    it('updates faculty and linked user fields', async () => {
      const adminToken = await getTokenByRole('ADMIN', 'admin-faculty-update');

      const createRes = await request(app)
        .post('/api/faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          createFacultyPayload({
            email: 'faculty-update@example.com',
            employeeId: 'EMP3001'
          })
        );

      const facultyId = createRes.body.faculty._id;

      const updateRes = await request(app)
        .put(`/api/faculty/${facultyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'faculty-update-new@example.com',
          password: 'newpass123',
          firstName: 'Updated',
          designation: 'HOD',
          employmentStatus: 'ON_LEAVE',
          phone: '9999999999'
        });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.faculty.firstName).toBe('Updated');
      expect(updateRes.body.faculty.designation).toBe('HOD');
      expect(updateRes.body.faculty.phone).toBe('9999999999');

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'faculty-update-new@example.com',
        password: 'newpass123'
      });

      expect(loginRes.statusCode).toBe(200);
    });

    it('returns 400 when updating with invalid faculty id', async () => {
      const adminToken = await getTokenByRole(
        'ADMIN',
        'admin-faculty-update-bad'
      );

      const res = await request(app)
        .put('/api/faculty/not-a-valid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Nope' });

      expect(res.statusCode).toBe(400);
    });

    it('deletes faculty and linked user', async () => {
      const adminToken = await getTokenByRole('ADMIN', 'admin-faculty-delete');

      const createRes = await request(app)
        .post('/api/faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          createFacultyPayload({
            email: 'faculty-delete@example.com',
            employeeId: 'EMP4001'
          })
        );

      const facultyId = createRes.body.faculty._id;
      const userId = createRes.body.faculty.userId;

      const deleteRes = await request(app)
        .delete(`/api/faculty/${facultyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.body.message).toBe('Faculty deleted successfully');

      const [faculty, user] = await Promise.all([
        Faculty.findById(facultyId),
        User.findById(userId)
      ]);

      expect(faculty).toBeNull();
      expect(user).toBeNull();
    });
  });

  describe('Bulk upload and analytics', () => {
    it('returns 400 for upload endpoint when file is missing', async () => {
      const adminToken = await getTokenByRole(
        'ADMIN',
        'admin-faculty-upload-400'
      );

      const res = await request(app)
        .post('/api/faculty/upload')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('No file uploaded');
    });

    it('uploads excel with mixed valid/invalid rows', async () => {
      const adminToken = await getTokenByRole(
        'ADMIN',
        'admin-faculty-upload-200'
      );

      const rows = [
        {
          Email: 'bulk1@example.com',
          FirstName: 'Ravi',
          LastName: 'Kumar',
          MobileNumber: '9876543210',
          EmployeeId: 'EMP5001',
          Designation: 'Professor',
          Department: 'Mechanical Engineering',
          DepartmentCode: 'MECH',
          Password: '123456'
        },
        {
          Email: 'bulk2@example.com',
          FirstName: 'Priya',
          LastName: 'M',
          Mobile: '9876543211',
          EmpId: 'EMP5002',
          Designation: 'Assistant Professor',
          Department: 'Mechanical Engineering',
          DeptCode: 'MECH',
          Password: '123456'
        },
        {
          Email: 'missing-data@example.com',
          FirstName: 'NoLast',
          Department: 'Mechanical Engineering'
        }
      ];

      const workbook = xlsx.utils.book_new();
      const sheet = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, sheet, 'Faculty');
      const excelBuffer = xlsx.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      });

      const res = await request(app)
        .post('/api/faculty/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', excelBuffer, 'faculty-upload.xlsx');

      expect(res.statusCode).toBe(200);
      expect(res.body.facultyCreated).toBe(2);
      expect(res.body.failedCount).toBe(1);

      const count = await Faculty.countDocuments();
      expect(count).toBe(2);
    });

    it('returns department-wise breakdown, list, and dashboard stats', async () => {
      const adminToken = await getTokenByRole('ADMIN', 'admin-faculty-stats');

      await request(app)
        .post('/api/faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          createFacultyPayload({
            email: 'stats-prof@example.com',
            employeeId: 'EMP6001',
            designation: 'Professor',
            departmentName: 'ECE',
            departmentCode: 'ECE'
          })
        );

      await request(app)
        .post('/api/faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          createFacultyPayload({
            email: 'stats-assist@example.com',
            employeeId: 'EMP6002',
            designation: 'Assistant Professor',
            departmentName: 'ECE',
            departmentCode: 'ECE'
          })
        );

      const dept = await Department.findOne({ name: 'ECE' });

      const [deptWiseRes, designationRes, listRes, dashboardRes] =
        await Promise.all([
          request(app)
            .get('/api/faculty/department-wise')
            .set('Authorization', `Bearer ${adminToken}`),
          request(app)
            .get(`/api/faculty/department-wise/${dept._id}`)
            .set('Authorization', `Bearer ${adminToken}`),
          request(app)
            .get(`/api/faculty/department-wise/${dept._id}/list`)
            .set('Authorization', `Bearer ${adminToken}`),
          request(app)
            .get('/api/faculty/dashboard/stats')
            .set('Authorization', `Bearer ${adminToken}`)
        ]);

      expect(deptWiseRes.statusCode).toBe(200);
      expect(designationRes.statusCode).toBe(200);
      expect(listRes.statusCode).toBe(200);
      expect(dashboardRes.statusCode).toBe(200);

      expect(Array.isArray(deptWiseRes.body)).toBe(true);
      expect(designationRes.body.categorySummary).toBeDefined();
      expect(listRes.body.total).toBe(2);
      expect(dashboardRes.body.totalFaculty).toBe(2);
      expect(dashboardRes.body.professors).toBe(1);
      expect(dashboardRes.body.associateAssistant).toBe(1);
    });

    it('returns 404 for unknown department in department endpoints', async () => {
      const adminToken = await getTokenByRole(
        'ADMIN',
        'admin-faculty-dept-404'
      );

      const res = await request(app)
        .get('/api/faculty/department-wise/unknown-department/list')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Department not found');
    });

    it('returns 400 for invalid faculty id while deleting', async () => {
      const adminToken = await getTokenByRole(
        'ADMIN',
        'admin-faculty-delete-badid'
      );

      const res = await request(app)
        .delete(
          `/api/faculty/${new mongoose.Types.ObjectId().toString().slice(0, 20)}`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });
});
