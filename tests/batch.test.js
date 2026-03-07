import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../app.js';
import Batch from '../models/Batch.js';
import User from '../models/User.js';

describe('Batch API', () => {
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

  describe('POST /api/batches', () => {
    test('should create batch with explicit values', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '2024-2028',
          startYear: 2024,
          endYear: 2028,
          programDuration: 4,
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Batch created successfully');
      expect(res.body.data.batch.name).toBe('2024-2028');
      expect(res.body.data.batch.startYear).toBe(2024);
      expect(res.body.data.batch.endYear).toBe(2028);
      expect(res.body.data.batch.programDuration).toBe(4);
      expect(res.body.data.batch.isActive).toBe(true);
    });

    test('should auto-derive endYear and name when omitted', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2025
        });

      expect(res.status).toBe(201);
      expect(res.body.data.batch.startYear).toBe(2025);
      expect(res.body.data.batch.endYear).toBe(2029);
      expect(res.body.data.batch.programDuration).toBe(4);
      expect(res.body.data.batch.name).toBe('2025-2029');
    });

    test('should derive endYear from custom programDuration', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2026,
          programDuration: 3
        });

      expect(res.status).toBe(201);
      expect(res.body.data.batch.startYear).toBe(2026);
      expect(res.body.data.batch.endYear).toBe(2029);
      expect(res.body.data.batch.programDuration).toBe(3);
      expect(res.body.data.batch.name).toBe('2026-2029');
    });

    test('should fail without token', async () => {
      const res = await request(app)
        .post('/api/batches')
        .send({ startYear: 2027 });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin role', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({ startYear: 2028 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail when startYear is missing', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('startYear is required');
    });

    test('should fail when endYear is not greater than startYear', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2030,
          endYear: 2030
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('endYear must be greater than startYear');
    });

    test('should fail for duplicate startYear-endYear pair', async () => {
      const token = await createAdminToken();

      await Batch.create({
        startYear: 2031,
        endYear: 2035,
        programDuration: 4,
        name: '2031-2035'
      });

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2031,
          endYear: 2035
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Batch already exists for this year range');
    });

    test('should fail when programDuration is below schema minimum', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2032,
          programDuration: -3
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('endYear must be greater than startYear');
    });
  });

  describe('GET /api/batches', () => {
    test('should fail without token', async () => {
      const res = await request(app).get('/api/batches');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should allow authenticated non-admin user', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .get('/api/batches')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.batches)).toBe(true);
    });

    test('should return batches sorted by startYear then name', async () => {
      const token = await createAdminToken();

      await Batch.create({ startYear: 2034, endYear: 2038, name: 'B-2034' });
      await Batch.create({ startYear: 2033, endYear: 2037, name: 'B-2033-Z' });
      await Batch.create({ startYear: 2033, endYear: 2039, name: 'B-2033-A' });

      const res = await request(app)
        .get('/api/batches')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.batches.map((b) => b.name)).toEqual([
        'B-2033-A',
        'B-2033-Z',
        'B-2034'
      ]);
    });

    test('should filter by isActive=true', async () => {
      const token = await createAdminToken();

      await Batch.create({
        startYear: 2035,
        endYear: 2039,
        name: 'Active Batch',
        isActive: true
      });
      await Batch.create({
        startYear: 2036,
        endYear: 2040,
        name: 'Inactive Batch',
        isActive: false
      });

      const res = await request(app)
        .get('/api/batches?isActive=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.batches.every((b) => b.isActive === true)).toBe(
        true
      );
    });

    test('should filter by isActive=false', async () => {
      const token = await createAdminToken();

      await Batch.create({
        startYear: 2037,
        endYear: 2041,
        name: 'Active Batch 2',
        isActive: true
      });
      await Batch.create({
        startYear: 2038,
        endYear: 2042,
        name: 'Inactive Batch 2',
        isActive: false
      });

      const res = await request(app)
        .get('/api/batches?isActive=false')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.batches.every((b) => b.isActive === false)).toBe(
        true
      );
    });
  });

  describe('GET /api/batches/:id', () => {
    test('should fail with invalid batch id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/batches/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid batch id');
    });

    test('should return 404 for non-existing batch', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/batches/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Batch not found');
    });

    test('should return batch by id', async () => {
      const token = await createAdminToken();
      const batch = await Batch.create({
        startYear: 2039,
        endYear: 2043,
        name: '2039-2043'
      });

      const res = await request(app)
        .get(`/api/batches/${batch._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Batch retrieved successfully');
      expect(res.body.data.batch._id).toBe(String(batch._id));
      expect(res.body.data.batch.name).toBe('2039-2043');
    });
  });

  describe('PUT /api/batches/:id', () => {
    test('should fail without token', async () => {
      const batch = await Batch.create({
        startYear: 2040,
        endYear: 2044,
        name: '2040-2044'
      });

      const res = await request(app)
        .put(`/api/batches/${batch._id}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const token = await createFacultyToken();
      const batch = await Batch.create({
        startYear: 2041,
        endYear: 2045,
        name: '2041-2045'
      });

      const res = await request(app)
        .put(`/api/batches/${batch._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'No Access Update' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail with invalid batch id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/batches/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Invalid Id Update' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid batch id');
    });

    test('should return 404 when batch not found', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/batches/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Not Found Update' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Batch not found');
    });

    test('should fail when target year range is invalid', async () => {
      const token = await createAdminToken();
      const batch = await Batch.create({
        startYear: 2042,
        endYear: 2046,
        name: '2042-2046'
      });

      const res = await request(app)
        .put(`/api/batches/${batch._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ endYear: 2040 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('endYear must be greater than startYear');
    });

    test('should fail when updated year range duplicates another batch', async () => {
      const token = await createAdminToken();

      await Batch.create({
        startYear: 2043,
        endYear: 2047,
        name: '2043-2047'
      });

      const target = await Batch.create({
        startYear: 2044,
        endYear: 2048,
        name: '2044-2048'
      });

      const res = await request(app)
        .put(`/api/batches/${target._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ startYear: 2043, endYear: 2047 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Batch already exists for this year range');
    });

    test('should update batch successfully', async () => {
      const token = await createAdminToken();
      const batch = await Batch.create({
        startYear: 2045,
        endYear: 2049,
        name: '2045-2049',
        isActive: true
      });

      const res = await request(app)
        .put(`/api/batches/${batch._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Batch',
          startYear: 2046,
          endYear: 2050,
          programDuration: 4,
          isActive: false,
          regulationId: '507f1f77bcf86cd799439011'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Batch updated successfully');
      expect(res.body.data.batch.name).toBe('Updated Batch');
      expect(res.body.data.batch.startYear).toBe(2046);
      expect(res.body.data.batch.endYear).toBe(2050);
      expect(res.body.data.batch.isActive).toBe(false);
      expect(res.body.data.batch.regulationId).toBeUndefined();
    });
  });

  describe('DELETE /api/batches/:id', () => {
    test('should fail with invalid batch id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/batches/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid batch id');
    });

    test('should return 404 for missing batch', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/batches/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Batch not found');
    });

    test('should delete batch successfully', async () => {
      const token = await createAdminToken();
      const batch = await Batch.create({
        startYear: 2047,
        endYear: 2051,
        name: '2047-2051'
      });

      const res = await request(app)
        .delete(`/api/batches/${batch._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Batch deleted successfully');

      const deleted = await Batch.findById(batch._id);
      expect(deleted).toBeNull();
    });
  });
});
