import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../app.js';
import Department from '../models/Department.js';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';

describe('Faculty API', () => {
  let seq = 0;
  const uniq = () => `${Date.now()}-${++seq}`;

  const createUser = async (overrides = {}) => {
    return await User.create({
      email: overrides.email || `user-${uniq()}@example.com`,
      password: overrides.password || 'password123',
      role: overrides.role || 'ADMIN',
      isActive:
        typeof overrides.isActive === 'boolean' ? overrides.isActive : true,
      gender: overrides.gender || 'Male'
    });
  };

  const createToken = (user) =>
    jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

  const createAdminToken = async () => createToken(await createUser());
  const createFacultyToken = async () =>
    createToken(await createUser({ role: 'FACULTY' }));
  const createStudentToken = async () =>
    createToken(await createUser({ role: 'STUDENT' }));

  const createDepartment = async (overrides = {}) => {
    const suffix = uniq();
    return await Department.create({
      name: overrides.name || `Department-${suffix}`,
      code: overrides.code || `D${suffix.slice(-5)}`
    });
  };

  const createFacultyRecord = async (overrides = {}) => {
    const department =
      overrides.department ||
      (await createDepartment({
        name: `Dept-${uniq()}`,
        code: `C${uniq().slice(-4)}`
      }));

    const user =
      overrides.user ||
      (await createUser({
        role: 'FACULTY',
        email: `faculty-${uniq()}@example.com`,
        isActive:
          typeof overrides.userIsActive === 'boolean'
            ? overrides.userIsActive
            : true,
        gender: 'Female'
      }));

    const faculty = await Faculty.create({
      userId: user._id,
      departmentId: department._id,
      salutation: overrides.salutation || 'Dr.',
      firstName: overrides.firstName || 'Asha',
      lastName: overrides.lastName || 'Raman',
      primaryPhone: overrides.primaryPhone || '9876543210',
      secondaryPhone: overrides.secondaryPhone || null,
      employeeId: overrides.employeeId || `EMP${uniq().slice(-5)}`,
      designation: overrides.designation || 'Assistant Professor',
      qualification: overrides.qualification || 'M.E',
      workType: overrides.workType || 'Full Time',
      joiningDate: overrides.joiningDate || new Date('2022-06-10'),
      reportingManager: overrides.reportingManager || null,
      noticePeriod: overrides.noticePeriod || '30 days',
      employmentStatus: overrides.employmentStatus || 'ACTIVE'
    });

    return { user, faculty, department };
  };

  describe('GET /api/faculty', () => {
    test('should fail without token', async () => {
      const res = await request(app).get('/api/faculty');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should deny student role', async () => {
      const token = await createStudentToken();

      const res = await request(app)
        .get('/api/faculty')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should return flattened isActive at faculty level', async () => {
      const token = await createFacultyToken();
      await createFacultyRecord({ userIsActive: false, employeeId: 'EMP1001' });

      const res = await request(app)
        .get('/api/faculty')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Faculty list retrieved successfully');
      expect(res.body.data.facultyList).toHaveLength(1);
      expect(res.body.data.facultyList[0].isActive).toBe(false);
      expect(res.body.data.facultyList[0].userId.isActive).toBeUndefined();
    });

    test('should fail on invalid departmentId filter', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/faculty?departmentId=bad-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid departmentId');
    });

    test('should filter by departmentId and employmentStatus', async () => {
      const token = await createAdminToken();
      const depA = await createDepartment({ name: 'DeptA', code: 'DPA' });
      const depB = await createDepartment({ name: 'DeptB', code: 'DPB' });

      await createFacultyRecord({
        department: depA,
        employeeId: 'EMP2001',
        employmentStatus: 'ACTIVE'
      });
      await createFacultyRecord({
        department: depA,
        employeeId: 'EMP2002',
        employmentStatus: 'RETIRED'
      });
      await createFacultyRecord({
        department: depB,
        employeeId: 'EMP2003',
        employmentStatus: 'ACTIVE'
      });

      const res = await request(app)
        .get(`/api/faculty?departmentId=${depA._id}&employmentStatus=ACTIVE`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.facultyList).toHaveLength(1);
      expect(res.body.data.facultyList[0].employeeId).toBe('EMP2001');
    });
  });

  describe('PUT /api/faculty/:id', () => {
    test('should fail with invalid faculty id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/faculty/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid faculty id');
    });

    test('should return 404 for missing faculty', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/faculty/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Faculty not found');
    });

    test('should fail when email already in use', async () => {
      const token = await createAdminToken();
      const target = await createFacultyRecord({ employeeId: 'EMP3001' });
      await createFacultyRecord({
        employeeId: 'EMP3002',
        user: await createUser({
          role: 'FACULTY',
          email: 'dup-fac@example.com'
        })
      });

      const res = await request(app)
        .put(`/api/faculty/${target.faculty._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'dup-fac@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Email already in use');
    });

    test('should fail for invalid workType', async () => {
      const token = await createAdminToken();
      const target = await createFacultyRecord({ employeeId: 'EMP3003' });

      const res = await request(app)
        .put(`/api/faculty/${target.faculty._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ workType: 'Temporary' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('workType must be one of');
    });

    test('should update faculty and linked user fields', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({
        name: 'Target Dept',
        code: 'TDEP'
      });
      const target = await createFacultyRecord({ employeeId: 'EMP3004' });

      const res = await request(app)
        .put(`/api/faculty/${target.faculty._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'updated-faculty@example.com',
          primaryPhone: '9998887776',
          designation: 'HOD',
          workType: 'Part Time',
          departmentId: String(department._id),
          employmentStatus: 'ON_LEAVE',
          isActive: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Faculty updated successfully');

      const [reloadedFaculty, reloadedUser] = await Promise.all([
        Faculty.findById(target.faculty._id),
        User.findById(target.user._id)
      ]);

      expect(reloadedFaculty.primaryPhone).toBe('9998887776');
      expect(reloadedFaculty.designation).toBe('HOD');
      expect(reloadedFaculty.workType).toBe('Part Time');
      expect(String(reloadedFaculty.departmentId)).toBe(String(department._id));
      expect(reloadedFaculty.employmentStatus).toBe('ON_LEAVE');
      expect(reloadedUser.email).toBe('updated-faculty@example.com');
      expect(reloadedUser.isActive).toBe(false);
    });
  });

  describe('DELETE /api/faculty/:id', () => {
    test('should fail with invalid faculty id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/faculty/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid faculty id');
    });

    test('should return 404 when faculty is missing', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/faculty/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Faculty not found');
    });

    test('should deactivate linked user and keep faculty record', async () => {
      const token = await createAdminToken();
      const { faculty, user } = await createFacultyRecord({
        employeeId: 'EMP4001'
      });

      const res = await request(app)
        .delete(`/api/faculty/${faculty._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Faculty deactivated successfully');

      const [savedFaculty, savedUser] = await Promise.all([
        Faculty.findById(faculty._id),
        User.findById(user._id)
      ]);

      expect(savedFaculty).toBeTruthy();
      expect(savedUser.isActive).toBe(false);
    });
  });

  describe('Department-wise and dashboard routes', () => {
    test('GET /api/faculty/department-wise should return grouped counts', async () => {
      const token = await createAdminToken();
      const depA = await createDepartment({ name: 'Count-A', code: 'CTA' });
      const depB = await createDepartment({ name: 'Count-B', code: 'CTB' });

      await createFacultyRecord({ department: depA, employeeId: 'EMP5001' });
      await createFacultyRecord({ department: depA, employeeId: 'EMP5002' });
      await createFacultyRecord({ department: depB, employeeId: 'EMP5003' });

      const res = await request(app)
        .get('/api/faculty/department-wise')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        'Department wise counts retrieved successfully'
      );
      expect(res.body.data.result).toHaveLength(2);
    });

    test('GET /api/faculty/department-wise/:department should validate input', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .get('/api/faculty/department-wise/bad-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid department ID format');
    });

    test('GET /api/faculty/department-wise/:department should return summary', async () => {
      const token = await createFacultyToken();
      const dep = await createDepartment({
        name: 'Summary Dept',
        code: 'SUMM'
      });

      await createFacultyRecord({
        department: dep,
        employeeId: 'EMP5004',
        designation: 'HOD'
      });
      await createFacultyRecord({
        department: dep,
        employeeId: 'EMP5005',
        designation: 'Professor'
      });
      await createFacultyRecord({
        department: dep,
        employeeId: 'EMP5006',
        designation: 'Assistant Professor'
      });

      const res = await request(app)
        .get(`/api/faculty/department-wise/${dep._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.categorySummary.deansAndHods).toBe(1);
      expect(res.body.data.categorySummary.professors).toBe(1);
      expect(res.body.data.categorySummary.associateAssistant).toBe(1);
    });

    test('GET /api/faculty/department-wise/:department/list should return list', async () => {
      const token = await createAdminToken();
      const dep = await createDepartment({ name: 'List Dept', code: 'LIST' });

      await createFacultyRecord({ department: dep, employeeId: 'EMP6001' });
      await createFacultyRecord({ department: dep, employeeId: 'EMP6002' });

      const res = await request(app)
        .get(`/api/faculty/department-wise/${dep._id}/list`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        'Department wise faculty list retrieved successfully'
      );
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.faculty).toHaveLength(2);
      expect(res.body.data.faculty[0].isActive).toBe(true);
    });

    test('GET /api/faculty/dashboard/stats should return aggregated stats', async () => {
      const token = await createFacultyToken();

      await createFacultyRecord({ employeeId: 'EMP7001', designation: 'Dean' });
      await createFacultyRecord({
        employeeId: 'EMP7002',
        designation: 'Professor'
      });
      await createFacultyRecord({
        employeeId: 'EMP7003',
        designation: 'Associate Professor'
      });
      await createFacultyRecord({
        employeeId: 'EMP7004',
        designation: 'Lab Technician'
      });

      const res = await request(app)
        .get('/api/faculty/dashboard/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Dashboard stats retrieved successfully');
      expect(res.body.data.totalFaculty).toBe(4);
      expect(res.body.data.deansAndHods).toBe(1);
      expect(res.body.data.professors).toBe(1);
      expect(res.body.data.associateAssistant).toBe(1);
      expect(res.body.data.others).toBe(1);
    });
  });
});
