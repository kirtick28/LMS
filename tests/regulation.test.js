import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../app.js';
import Regulation from '../models/Regulation.js';
import User from '../models/User.js';

describe('Regulation API', () => {
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

  describe('POST /api/regulations', () => {
    test('should create regulation with normalized name', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: ' r2026 ',
          startYear: 2026,
          totalSemesters: 6,
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Regulation created successfully');
      expect(res.body.data.regulation.name).toBe('R2026');
      expect(res.body.data.regulation.startYear).toBe(2026);
      expect(res.body.data.regulation.totalSemesters).toBe(6);
      expect(res.body.data.regulation.isActive).toBe(true);
    });

    test('should create regulation with auto-generated name from startYear', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2027
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.regulation.name).toBe('R2027');
      expect(res.body.data.regulation.startYear).toBe(2027);
      expect(res.body.data.regulation.totalSemesters).toBe(8);
    });

    test('should normalize totalSemesters to 8 when invalid value is provided', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2028,
          totalSemesters: 0
        });

      expect(res.status).toBe(201);
      expect(res.body.data.regulation.totalSemesters).toBe(8);
    });

    test('should clamp totalSemesters to 8 when value is above max', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2029,
          totalSemesters: 100
        });

      expect(res.status).toBe(201);
      expect(res.body.data.regulation.totalSemesters).toBe(8);
    });

    test('should fail without token', async () => {
      const res = await request(app).post('/api/regulations').send({
        startYear: 2030
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2031
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail when both name and startYear are missing', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('name or startYear is required');
    });

    test('should fail when duplicate name exists', async () => {
      const token = await createAdminToken();

      await Regulation.create({
        name: 'R2032',
        startYear: 2032
      });

      const res = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'r2032',
          startYear: 2040
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Regulation already exists');
    });

    test('should fail when duplicate startYear exists', async () => {
      const token = await createAdminToken();

      await Regulation.create({
        name: 'R2033',
        startYear: 2033
      });

      const res = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'R9999',
          startYear: 2033
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Regulation already exists');
    });
  });

  describe('GET /api/regulations', () => {
    test('should fail without token', async () => {
      const res = await request(app).get('/api/regulations');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should allow authenticated non-admin user', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .get('/api/regulations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.regulations)).toBe(true);
    });

    test('should return regulations sorted by startYear desc then name asc', async () => {
      const token = await createAdminToken();

      await Regulation.create({
        name: 'R2034B',
        startYear: 2034
      });
      await Regulation.create({
        name: 'R2034A',
        startYear: 2034
      });
      await Regulation.create({
        name: 'R2035',
        startYear: 2035
      });

      const res = await request(app)
        .get('/api/regulations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.regulations.map((r) => r.name)).toEqual([
        'R2035',
        'R2034A',
        'R2034B'
      ]);
    });

    test('should filter by isActive=true', async () => {
      const token = await createAdminToken();

      await Regulation.create({
        name: 'R2036A',
        startYear: 2036,
        isActive: true
      });
      await Regulation.create({
        name: 'R2036B',
        startYear: 2037,
        isActive: false
      });

      const res = await request(app)
        .get('/api/regulations?isActive=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.regulations.every((r) => r.isActive === true)).toBe(
        true
      );
    });

    test('should filter by isActive=false', async () => {
      const token = await createAdminToken();

      await Regulation.create({
        name: 'R2038A',
        startYear: 2038,
        isActive: true
      });
      await Regulation.create({
        name: 'R2038B',
        startYear: 2039,
        isActive: false
      });

      const res = await request(app)
        .get('/api/regulations?isActive=false')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.regulations.every((r) => r.isActive === false)).toBe(
        true
      );
    });
  });

  describe('GET /api/regulations/:id', () => {
    test('should fail with invalid regulation id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/regulations/not-valid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid regulation id');
    });

    test('should return 404 for non-existing regulation', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/regulations/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Regulation not found');
    });

    test('should return regulation by id', async () => {
      const token = await createAdminToken();
      const regulation = await Regulation.create({
        name: 'R2040',
        startYear: 2040,
        totalSemesters: 8
      });

      const res = await request(app)
        .get(`/api/regulations/${regulation._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Regulation retrieved successfully');
      expect(res.body.data.regulation._id).toBe(String(regulation._id));
      expect(res.body.data.regulation.name).toBe('R2040');
    });
  });

  describe('PUT /api/regulations/:id', () => {
    test('should fail without token', async () => {
      const regulation = await Regulation.create({
        name: 'R2041',
        startYear: 2041
      });

      const res = await request(app)
        .put(`/api/regulations/${regulation._id}`)
        .send({ name: 'R2041A' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const token = await createFacultyToken();
      const regulation = await Regulation.create({
        name: 'R2042',
        startYear: 2042
      });

      const res = await request(app)
        .put(`/api/regulations/${regulation._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'R2042A' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail with invalid regulation id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/regulations/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'R2043' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid regulation id');
    });

    test('should return 404 when regulation not found', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/regulations/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'R4040' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Regulation not found');
    });

    test('should fail on duplicate updated name', async () => {
      const token = await createAdminToken();
      const reg1 = await Regulation.create({ name: 'R2044A', startYear: 2044 });
      await Regulation.create({ name: 'R2044B', startYear: 2045 });

      const res = await request(app)
        .put(`/api/regulations/${reg1._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'r2044b' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Regulation name already exists');
    });

    test('should fail on duplicate updated startYear', async () => {
      const token = await createAdminToken();
      const reg1 = await Regulation.create({ name: 'R2046A', startYear: 2046 });
      await Regulation.create({ name: 'R2047A', startYear: 2047 });

      const res = await request(app)
        .put(`/api/regulations/${reg1._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ startYear: 2047 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Regulation with same startYear already exists'
      );
    });

    test('should update regulation and normalize fields', async () => {
      const token = await createAdminToken();
      const regulation = await Regulation.create({
        name: 'R2048',
        startYear: 2048,
        totalSemesters: 8,
        isActive: true
      });

      const res = await request(app)
        .put(`/api/regulations/${regulation._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: ' r2048 updated ',
          startYear: 2049,
          totalSemesters: -10,
          isActive: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Regulation updated successfully');
      expect(res.body.data.regulation.name).toBe('R2048 UPDATED');
      expect(res.body.data.regulation.startYear).toBe(2049);
      expect(res.body.data.regulation.totalSemesters).toBe(1);
      expect(res.body.data.regulation.isActive).toBe(false);
    });

    test('should clamp updated totalSemesters to max 8', async () => {
      const token = await createAdminToken();
      const regulation = await Regulation.create({
        name: 'R2050',
        startYear: 2050,
        totalSemesters: 6
      });

      const res = await request(app)
        .put(`/api/regulations/${regulation._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ totalSemesters: 999 });

      expect(res.status).toBe(200);
      expect(res.body.data.regulation.totalSemesters).toBe(8);
    });
  });

  describe('DELETE /api/regulations/:id', () => {
    test('should fail without token', async () => {
      const regulation = await Regulation.create({
        name: 'R2051',
        startYear: 2051
      });

      const res = await request(app).delete(
        `/api/regulations/${regulation._id}`
      );

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const token = await createFacultyToken();
      const regulation = await Regulation.create({
        name: 'R2052',
        startYear: 2052
      });

      const res = await request(app)
        .delete(`/api/regulations/${regulation._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail with invalid regulation id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/regulations/not-valid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid regulation id');
    });

    test('should return 404 when regulation not found', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/regulations/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Regulation not found');
    });

    test('should delete regulation successfully', async () => {
      const token = await createAdminToken();
      const regulation = await Regulation.create({
        name: 'R2053',
        startYear: 2053
      });

      const res = await request(app)
        .delete(`/api/regulations/${regulation._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Regulation deleted successfully');

      const deleted = await Regulation.findById(regulation._id);
      expect(deleted).toBeNull();
    });
  });
});
