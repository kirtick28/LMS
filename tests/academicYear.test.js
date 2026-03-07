import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../app.js';
import AcademicYear from '../models/AcademicYear.js';
import User from '../models/User.js';

describe('Academic Year API', () => {
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

  const createToken = (user) =>
    jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

  const createAdminToken = async () => {
    const admin = await createUser({ role: 'ADMIN' });
    return createToken(admin);
  };

  const createFacultyToken = async () => {
    const faculty = await createUser({ role: 'FACULTY' });
    return createToken(faculty);
  };

  describe('POST /api/academic-years', () => {
    test('should create academic year successfully', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2025,
          endYear: 2026,
          startMonth: 7,
          endMonth: 5,
          isActive: false
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Academic Year created successfully');
      expect(res.body.data.academicYear.name).toBe('2025-2026');
      expect(res.body.data.academicYear.startYear).toBe(2025);
      expect(res.body.data.academicYear.endYear).toBe(2026);
      expect(res.body.data.academicYear.startMonth).toBe(7);
      expect(res.body.data.academicYear.endMonth).toBe(5);
      expect(res.body.data.academicYear.isActive).toBe(false);
    });

    test('should fail without token', async () => {
      const res = await request(app).post('/api/academic-years').send({
        startYear: 2026,
        endYear: 2027
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin role', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2026,
          endYear: 2027
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail when startYear or endYear is missing', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({ startYear: 2026 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('startYear and endYear are required');
    });

    test('should fail for duplicate academic year name', async () => {
      const token = await createAdminToken();

      await AcademicYear.create({
        name: '2027-2028',
        startYear: 2027,
        endYear: 2028,
        isActive: false
      });

      const res = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2027,
          endYear: 2028
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Academic Year already exists');
    });

    test('should make only new record active when isActive=true', async () => {
      const token = await createAdminToken();

      const existing = await AcademicYear.create({
        name: '2028-2029',
        startYear: 2028,
        endYear: 2029,
        isActive: true
      });

      const res = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2029,
          endYear: 2030,
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.data.academicYear.isActive).toBe(true);

      const reloadedOld = await AcademicYear.findById(existing._id);
      expect(reloadedOld.isActive).toBe(false);
    });

    test('should fail when endYear is not greater than startYear', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2030,
          endYear: 2030
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Something went wrong!');
    });

    test('should fail when startMonth is invalid', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2031,
          endYear: 2032,
          startMonth: 13
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Something went wrong!');
    });
  });

  describe('GET /api/academic-years', () => {
    test('should fail without token', async () => {
      const res = await request(app).get('/api/academic-years');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should allow authenticated non-admin user', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .get('/api/academic-years')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.academicYears)).toBe(true);
    });

    test('should return academic years sorted by startYear desc', async () => {
      const token = await createAdminToken();

      await AcademicYear.create({
        name: '2032-2033',
        startYear: 2032,
        endYear: 2033,
        isActive: false
      });
      await AcademicYear.create({
        name: '2034-2035',
        startYear: 2034,
        endYear: 2035,
        isActive: false
      });

      const res = await request(app)
        .get('/api/academic-years')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.academicYears.map((a) => a.startYear)).toEqual([
        2034, 2032
      ]);
    });

    test('should filter by isActive=true', async () => {
      const token = await createAdminToken();

      await AcademicYear.create({
        name: '2035-2036',
        startYear: 2035,
        endYear: 2036,
        isActive: true
      });
      await AcademicYear.create({
        name: '2036-2037',
        startYear: 2036,
        endYear: 2037,
        isActive: false
      });

      const res = await request(app)
        .get('/api/academic-years?isActive=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.academicYears.every((a) => a.isActive === true)
      ).toBe(true);
    });

    test('should filter by isActive=false', async () => {
      const token = await createAdminToken();

      await AcademicYear.create({
        name: '2037-2038',
        startYear: 2037,
        endYear: 2038,
        isActive: true
      });
      await AcademicYear.create({
        name: '2038-2039',
        startYear: 2038,
        endYear: 2039,
        isActive: false
      });

      const res = await request(app)
        .get('/api/academic-years?isActive=false')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.academicYears.every((a) => a.isActive === false)
      ).toBe(true);
    });
  });

  describe('GET /api/academic-years/:id', () => {
    test('should fail with invalid academic year id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/academic-years/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid Academic Year id');
    });

    test('should return 404 for non-existing academic year', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/academic-years/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Academic Year not found');
    });

    test('should return academic year by id', async () => {
      const token = await createAdminToken();
      const academicYear = await AcademicYear.create({
        name: '2039-2040',
        startYear: 2039,
        endYear: 2040,
        isActive: false
      });

      const res = await request(app)
        .get(`/api/academic-years/${academicYear._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Academic Year retrieved successfully');
      expect(res.body.data.academicYear._id).toBe(String(academicYear._id));
      expect(res.body.data.academicYear.name).toBe('2039-2040');
    });
  });

  describe('PUT /api/academic-years/:id', () => {
    test('should fail without token', async () => {
      const academicYear = await AcademicYear.create({
        name: '2040-2041',
        startYear: 2040,
        endYear: 2041,
        isActive: false
      });

      const res = await request(app)
        .put(`/api/academic-years/${academicYear._id}`)
        .send({ isActive: true });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin role', async () => {
      const token = await createFacultyToken();
      const academicYear = await AcademicYear.create({
        name: '2041-2042',
        startYear: 2041,
        endYear: 2042,
        isActive: false
      });

      const res = await request(app)
        .put(`/api/academic-years/${academicYear._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail with invalid academic year id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/academic-years/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid Academic Year id');
    });

    test('should return 404 when academic year does not exist', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/academic-years/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Academic Year not found');
    });

    test('should deactivate others when current is set active', async () => {
      const token = await createAdminToken();

      const oldActive = await AcademicYear.create({
        name: '2042-2043',
        startYear: 2042,
        endYear: 2043,
        isActive: true
      });

      const target = await AcademicYear.create({
        name: '2043-2044',
        startYear: 2043,
        endYear: 2044,
        isActive: false
      });

      const res = await request(app)
        .put(`/api/academic-years/${target._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body.data.academicYear.isActive).toBe(true);

      const oldReload = await AcademicYear.findById(oldActive._id);
      expect(oldReload.isActive).toBe(false);
    });

    test('should update name to short end-year format when years are updated', async () => {
      const token = await createAdminToken();

      const ay = await AcademicYear.create({
        name: '2044-2045',
        startYear: 2044,
        endYear: 2045,
        isActive: false
      });

      const res = await request(app)
        .put(`/api/academic-years/${ay._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2045,
          endYear: 2046
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Academic Year updated successfully');
      expect(res.body.data.academicYear.startYear).toBe(2045);
      expect(res.body.data.academicYear.endYear).toBe(2046);
      expect(res.body.data.academicYear.name).toBe('2045-46');
    });

    test('should fail when updated years collide with existing short-format name', async () => {
      const token = await createAdminToken();

      await AcademicYear.create({
        name: '2046-47',
        startYear: 2046,
        endYear: 2047,
        isActive: false
      });

      const target = await AcademicYear.create({
        name: '2047-2048',
        startYear: 2047,
        endYear: 2048,
        isActive: false
      });

      const res = await request(app)
        .put(`/api/academic-years/${target._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2046,
          endYear: 2047
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Academic Year already exists');
    });
  });

  describe('DELETE /api/academic-years/:id', () => {
    test('should fail with invalid academic year id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/academic-years/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid Academic Year id');
    });

    test('should return 404 for missing academic year', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/academic-years/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Academic Year not found');
    });

    test('should delete academic year successfully', async () => {
      const token = await createAdminToken();
      const academicYear = await AcademicYear.create({
        name: '2048-2049',
        startYear: 2048,
        endYear: 2049,
        isActive: false
      });

      const res = await request(app)
        .delete(`/api/academic-years/${academicYear._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Academic Year deleted successfully');
      expect(res.body.data).toEqual({});

      const deleted = await AcademicYear.findById(academicYear._id);
      expect(deleted).toBeNull();
    });
  });
});
