import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../app.js';
import Department from '../models/Department.js';
import User from '../models/User.js';

describe('Department API', () => {
  const createUser = async (overrides = {}) => {
    return await User.create({
      email:
        overrides.email || `user-${Date.now()}-${Math.random()}@example.com`,
      password: overrides.password || 'password123',
      role: overrides.role || 'ADMIN',
      isActive:
        typeof overrides.isActive === 'boolean' ? overrides.isActive : true
    });
  };

  const createAuthToken = (user) =>
    jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

  const createAdminToken = async () => {
    const admin = await createUser({
      email: `admin-${Date.now()}-${Math.random()}@example.com`,
      role: 'ADMIN'
    });
    return createAuthToken(admin);
  };

  const createFacultyToken = async () => {
    const faculty = await createUser({
      email: `faculty-${Date.now()}-${Math.random()}@example.com`,
      role: 'FACULTY'
    });
    return createAuthToken(faculty);
  };

  describe('POST /api/departments', () => {
    test('should create department with normalized code', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Computer Science and Engineering',
          code: ' c-s.e ',
          program: 'B.Tech.'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Department created successfully');
      expect(res.body.data.department.name).toBe(
        'Computer Science and Engineering'
      );
      expect(res.body.data.department.code).toBe('CSE');
      expect(res.body.data.department.program).toBe('B.Tech.');
      expect(res.body.data.department.isActive).toBe(true);
    });

    test('should allow explicit isActive false', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Mechanical Engineering',
          code: 'MECH',
          isActive: false
        });

      expect(res.status).toBe(201);
      expect(res.body.data.department.isActive).toBe(false);
    });

    test('should fail without token', async () => {
      const res = await request(app).post('/api/departments').send({
        name: 'Civil Engineering',
        code: 'CIV'
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const facultyToken = await createFacultyToken();

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          name: 'Electronics and Communication',
          code: 'ECE'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail when name or code is missing', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'EEE' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('name and code are required');
    });

    test('should fail on duplicate name', async () => {
      const token = await createAdminToken();

      await Department.create({
        name: 'Information Technology',
        code: 'IT'
      });

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Information Technology',
          code: 'ITNEW'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Department with same name or code already exists'
      );
    });

    test('should fail on duplicate code (case-insensitive via normalization)', async () => {
      const token = await createAdminToken();

      await Department.create({
        name: 'Artificial Intelligence',
        code: 'AIML'
      });

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'AI and Data Science',
          code: 'aiml'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Department with same name or code already exists'
      );
    });

    test('should fail for invalid program', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Biomedical Engineering',
          code: 'BME',
          program: 'M.E.'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid input data');
    });
  });

  describe('GET /api/departments', () => {
    test('should fail without token', async () => {
      const res = await request(app).get('/api/departments');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should allow authenticated non-admin user', async () => {
      const facultyToken = await createFacultyToken();

      const res = await request(app)
        .get('/api/departments')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.departments)).toBe(true);
    });

    test('should return departments sorted by name', async () => {
      const token = await createAdminToken();

      await Department.create({ name: 'ZZ Dept', code: 'ZZ' });
      await Department.create({ name: 'AA Dept', code: 'AA' });

      const res = await request(app)
        .get('/api/departments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const names = res.body.data.departments.map((d) => d.name);
      expect(names[0]).toBe('AA Dept');
      expect(names[1]).toBe('ZZ Dept');
    });

    test('should filter departments by isActive=true', async () => {
      const token = await createAdminToken();

      await Department.create({
        name: 'Active Dept',
        code: 'ACT',
        isActive: true
      });
      await Department.create({
        name: 'Inactive Dept',
        code: 'INACT',
        isActive: false
      });

      const res = await request(app)
        .get('/api/departments?isActive=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.departments.every((d) => d.isActive === true)).toBe(
        true
      );
    });

    test('should filter departments by isActive=false', async () => {
      const token = await createAdminToken();

      await Department.create({
        name: 'Active Dept',
        code: 'ACT2',
        isActive: true
      });
      await Department.create({
        name: 'Inactive Dept',
        code: 'INACT2',
        isActive: false
      });

      const res = await request(app)
        .get('/api/departments?isActive=false')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.departments.every((d) => d.isActive === false)).toBe(
        true
      );
    });
  });

  describe('GET /api/departments/:id', () => {
    test('should fail without token', async () => {
      const department = await Department.create({ name: 'Temp', code: 'TMP' });
      const res = await request(app).get(`/api/departments/${department._id}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail with invalid department id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/departments/not-a-valid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid department id');
    });

    test('should return 404 for valid but non-existing id', async () => {
      const token = await createAdminToken();
      const missingId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .get(`/api/departments/${missingId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Department not found');
    });

    test('should return department by id', async () => {
      const token = await createAdminToken();
      const department = await Department.create({
        name: 'Chemical Engineering',
        code: 'CHEM'
      });

      const res = await request(app)
        .get(`/api/departments/${department._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.department._id).toBe(String(department._id));
      expect(res.body.data.department.name).toBe('Chemical Engineering');
      expect(res.body.data.department.code).toBe('CHEM');
    });
  });

  describe('PUT /api/departments/:id', () => {
    test('should fail without token', async () => {
      const department = await Department.create({
        name: 'Production Engineering',
        code: 'PROD'
      });

      const res = await request(app)
        .put(`/api/departments/${department._id}`)
        .send({ name: 'Prod Eng Updated' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const facultyToken = await createFacultyToken();
      const department = await Department.create({
        name: 'Aerospace Engineering',
        code: 'AERO'
      });

      const res = await request(app)
        .put(`/api/departments/${department._id}`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ name: 'Aerospace Updated' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail with invalid department id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/departments/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid department id');
    });

    test('should return 404 when department not found', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/departments/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Not Found Dept' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Department not found');
    });

    test('should fail on duplicate updated name', async () => {
      const token = await createAdminToken();

      const dep1 = await Department.create({ name: 'Dept One', code: 'D1' });
      await Department.create({ name: 'Dept Two', code: 'D2' });

      const res = await request(app)
        .put(`/api/departments/${dep1._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Dept Two' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Department name already exists');
    });

    test('should fail on duplicate updated code', async () => {
      const token = await createAdminToken();

      const dep1 = await Department.create({ name: 'Dept Three', code: 'D3' });
      await Department.create({ name: 'Dept Four', code: 'D4' });

      const res = await request(app)
        .put(`/api/departments/${dep1._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'd4' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Department code already exists');
    });

    test('should update department successfully', async () => {
      const token = await createAdminToken();

      const dep = await Department.create({
        name: 'Old Name',
        code: 'OLD1',
        program: 'B.E.'
      });

      const res = await request(app)
        .put(`/api/departments/${dep._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '  New Name  ',
          code: ' new1 ',
          program: 'B.Tech.',
          isActive: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Department updated successfully');
      expect(res.body.data.department.name).toBe('New Name');
      expect(res.body.data.department.code).toBe('NEW1');
      expect(res.body.data.department.program).toBe('B.Tech.');
      expect(res.body.data.department.isActive).toBe(false);
    });

    test('should fail for invalid updated program', async () => {
      const token = await createAdminToken();
      const dep = await Department.create({
        name: 'Program Dept',
        code: 'PRG'
      });

      const res = await request(app)
        .put(`/api/departments/${dep._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ program: 'MBA' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid input data');
    });
  });

  describe('DELETE /api/departments/:id', () => {
    test('should fail without token', async () => {
      const department = await Department.create({
        name: 'Delete Temp',
        code: 'DT'
      });

      const res = await request(app).delete(
        `/api/departments/${department._id}`
      );

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const facultyToken = await createFacultyToken();
      const department = await Department.create({
        name: 'Delete Non Admin',
        code: 'DNA'
      });

      const res = await request(app)
        .delete(`/api/departments/${department._id}`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail with invalid department id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/departments/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid department id');
    });

    test('should return 404 when department not found', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/departments/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Department not found');
    });

    test('should delete department successfully', async () => {
      const token = await createAdminToken();
      const department = await Department.create({
        name: 'Delete Department',
        code: 'DEL'
      });

      const res = await request(app)
        .delete(`/api/departments/${department._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Department deleted successfully');

      const deleted = await Department.findById(department._id);
      expect(deleted).toBeNull();
    });
  });
});
