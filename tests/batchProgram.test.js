import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../app.js';
import Batch from '../models/Batch.js';
import BatchProgram from '../models/BatchProgram.js';
import Department from '../models/Department.js';
import Regulation from '../models/Regulation.js';
import Section from '../models/Section.js';
import User from '../models/User.js';

describe('BatchProgram API', () => {
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

  const createBatch = async (overrides = {}) => {
    return await Batch.create({
      startYear: overrides.startYear || 2024,
      endYear: overrides.endYear || 2028,
      name: overrides.name || '2024-2028',
      programDuration:
        overrides.programDuration === undefined ? 4 : overrides.programDuration
    });
  };

  const createDepartment = async (overrides = {}) => {
    return await Department.create({
      name: overrides.name || `Department-${Date.now()}-${Math.random()}`,
      code: overrides.code || `D${Math.floor(Math.random() * 100000)}`,
      program: overrides.program || 'B.E.'
    });
  };

  const createRegulation = async (overrides = {}) => {
    return await Regulation.create({
      name: overrides.name || `R${Math.floor(Math.random() * 100000)}`,
      startYear: overrides.startYear || 2024,
      totalSemesters:
        overrides.totalSemesters === undefined ? 8 : overrides.totalSemesters
    });
  };

  describe('POST /api/batch-programs', () => {
    test('should create batch program and auto-create UNALLOCATED section', async () => {
      const token = await createAdminToken();
      const [batch, department, regulation] = await Promise.all([
        createBatch({ name: '2024-2028' }),
        createDepartment({ code: 'CSE' }),
        createRegulation({ name: 'R2024', startYear: 2024 })
      ]);

      const res = await request(app)
        .post('/api/batch-programs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchId: String(batch._id),
          departmentId: String(department._id),
          regulationId: String(regulation._id)
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        'BatchProgram and UNALLOCATED section created successfully'
      );
      expect(res.body.data.batchProgram.batchId._id).toBe(String(batch._id));
      expect(res.body.data.batchProgram.departmentId._id).toBe(
        String(department._id)
      );
      expect(res.body.data.batchProgram.regulationId._id).toBe(
        String(regulation._id)
      );

      const section = await Section.findOne({
        batchProgramId: res.body.data.batchProgram._id,
        name: 'UNALLOCATED'
      });
      expect(section).toBeTruthy();
      expect(section.capacity).toBe(300);
      expect(section.isActive).toBe(true);
    });

    test('should fail without token', async () => {
      const res = await request(app).post('/api/batch-programs').send({});

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .post('/api/batch-programs')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail when required ids are missing', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/batch-programs')
        .set('Authorization', `Bearer ${token}`)
        .send({ batchId: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'batchId, departmentId, and regulationId are required'
      );
    });

    test('should fail for invalid object ids', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/batch-programs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchId: 'bad',
          departmentId: 'bad',
          regulationId: 'bad'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid ObjectId provided');
    });

    test('should fail when referenced entities are not found', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/batch-programs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchId: '507f1f77bcf86cd799439011',
          departmentId: '507f1f77bcf86cd799439012',
          regulationId: '507f1f77bcf86cd799439013'
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        'Batch, Department, or Regulation not found'
      );
    });

    test('should fail for duplicate batch-department mapping', async () => {
      const token = await createAdminToken();
      const [batch, department, regulation] = await Promise.all([
        createBatch({ startYear: 2025, endYear: 2029, name: '2025-2029' }),
        createDepartment({ code: 'ECE' }),
        createRegulation({ name: 'R2025', startYear: 2025 })
      ]);

      await BatchProgram.create({
        batchId: batch._id,
        departmentId: department._id,
        regulationId: regulation._id
      });

      const res = await request(app)
        .post('/api/batch-programs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchId: String(batch._id),
          departmentId: String(department._id),
          regulationId: String(regulation._id)
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'This department is already mapped to this batch'
      );
    });
  });

  describe('GET /api/batch-programs', () => {
    test('should fail without token', async () => {
      const res = await request(app).get('/api/batch-programs');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should allow authenticated non-admin user', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .get('/api/batch-programs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.batchPrograms)).toBe(true);
    });

    test('should fail on invalid query ids', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/batch-programs?batchId=bad')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid batchId');
    });

    test('should filter by batchId, departmentId, and regulationId', async () => {
      const token = await createAdminToken();
      const [batchA, batchB] = await Promise.all([
        createBatch({ startYear: 2026, endYear: 2030, name: '2026-2030' }),
        createBatch({ startYear: 2027, endYear: 2031, name: '2027-2031' })
      ]);
      const [depA, depB] = await Promise.all([
        createDepartment({ code: 'IT' }),
        createDepartment({ code: 'MECH' })
      ]);
      const [regA, regB] = await Promise.all([
        createRegulation({ name: 'R2026', startYear: 2026 }),
        createRegulation({ name: 'R2027', startYear: 2027 })
      ]);

      await BatchProgram.create({
        batchId: batchA._id,
        departmentId: depA._id,
        regulationId: regA._id
      });
      await BatchProgram.create({
        batchId: batchA._id,
        departmentId: depB._id,
        regulationId: regA._id
      });
      await BatchProgram.create({
        batchId: batchB._id,
        departmentId: depA._id,
        regulationId: regB._id
      });

      const res = await request(app)
        .get(
          `/api/batch-programs?batchId=${batchA._id}&departmentId=${depA._id}&regulationId=${regA._id}`
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.batchPrograms).toHaveLength(1);
      expect(res.body.data.batchPrograms[0].batchId._id).toBe(
        String(batchA._id)
      );
      expect(res.body.data.batchPrograms[0].departmentId._id).toBe(
        String(depA._id)
      );
      expect(res.body.data.batchPrograms[0].regulationId._id).toBe(
        String(regA._id)
      );
    });
  });

  describe('GET /api/batch-programs/:batchId/:departmentId', () => {
    test('should fail when batchId or departmentId is invalid', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/batch-programs/bad/bad')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid batchId or departmentId');
    });

    test('should return 404 when batch or department not found', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get(
          '/api/batch-programs/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012'
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        'Batch, Department, or Regulation not found'
      );
    });

    test('should return informative 404 when mapping does not exist', async () => {
      const token = await createAdminToken();
      const [batch, department] = await Promise.all([
        createBatch({ startYear: 2028, endYear: 2032, name: '2028-2032' }),
        createDepartment({ code: 'CIV' })
      ]);

      const res = await request(app)
        .get(`/api/batch-programs/${batch._id}/${department._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        'BatchProgram not found for this department and batch'
      );
      expect(res.body.data.batchProgram.batchId._id).toBe(String(batch._id));
      expect(res.body.data.batchProgram.departmentId._id).toBe(
        String(department._id)
      );
    });

    test('should return mapping details when found', async () => {
      const token = await createAdminToken();
      const [batch, department, regulation] = await Promise.all([
        createBatch({ startYear: 2029, endYear: 2033, name: '2029-2033' }),
        createDepartment({ code: 'EEE' }),
        createRegulation({ name: 'R2029', startYear: 2029 })
      ]);

      const batchProgram = await BatchProgram.create({
        batchId: batch._id,
        departmentId: department._id,
        regulationId: regulation._id
      });

      const res = await request(app)
        .get(`/api/batch-programs/${batch._id}/${department._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(
        'BatchProgram details retrieved successfully'
      );
      expect(res.body.data.batchProgramId).toBe(String(batchProgram._id));
      expect(res.body.data.batchProgram.batchId._id).toBe(String(batch._id));
      expect(res.body.data.batchProgram.departmentId._id).toBe(
        String(department._id)
      );
    });
  });

  describe('GET /api/batch-programs/:id', () => {
    test('should fail with invalid id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/batch-programs/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid BatchProgram id');
    });

    test('should return 404 when not found', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/batch-programs/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('BatchProgram not found');
    });

    test('should return batch program by id', async () => {
      const token = await createAdminToken();
      const [batch, department, regulation] = await Promise.all([
        createBatch({ startYear: 2030, endYear: 2034, name: '2030-2034' }),
        createDepartment({ code: 'AERO' }),
        createRegulation({ name: 'R2030', startYear: 2030 })
      ]);

      const batchProgram = await BatchProgram.create({
        batchId: batch._id,
        departmentId: department._id,
        regulationId: regulation._id
      });

      const res = await request(app)
        .get(`/api/batch-programs/${batchProgram._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('BatchProgram retrieved successfully');
      expect(res.body.data.batchProgram._id).toBe(String(batchProgram._id));
    });
  });

  describe('PUT /api/batch-programs/:id', () => {
    test('should fail without token', async () => {
      const res = await request(app)
        .put('/api/batch-programs/507f1f77bcf86cd799439011')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .put('/api/batch-programs/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail with invalid id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/batch-programs/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid BatchProgram id');
    });

    test('should return 404 when mapping not found', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/batch-programs/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('BatchProgram not found');
    });

    test('should fail when update id fields are invalid', async () => {
      const token = await createAdminToken();
      const [batch, department, regulation] = await Promise.all([
        createBatch({ startYear: 2031, endYear: 2035, name: '2031-2035' }),
        createDepartment({ code: 'CHEM' }),
        createRegulation({ name: 'R2031', startYear: 2031 })
      ]);

      const batchProgram = await BatchProgram.create({
        batchId: batch._id,
        departmentId: department._id,
        regulationId: regulation._id
      });

      const res = await request(app)
        .put(`/api/batch-programs/${batchProgram._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId: 'bad-id' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid departmentId');
    });

    test('should fail when referenced entities are missing on update', async () => {
      const token = await createAdminToken();
      const [batch, department, regulation] = await Promise.all([
        createBatch({ startYear: 2032, endYear: 2036, name: '2032-2036' }),
        createDepartment({ code: 'TEXT' }),
        createRegulation({ name: 'R2032', startYear: 2032 })
      ]);

      const batchProgram = await BatchProgram.create({
        batchId: batch._id,
        departmentId: department._id,
        regulationId: regulation._id
      });

      const res = await request(app)
        .put(`/api/batch-programs/${batchProgram._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ regulationId: '507f1f77bcf86cd799439011' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        'Referenced Batch, Department, or Regulation not found'
      );
    });

    test('should fail on duplicate batch-department combination during update', async () => {
      const token = await createAdminToken();
      const [batch, depA, depB, reg] = await Promise.all([
        createBatch({ startYear: 2033, endYear: 2037, name: '2033-2037' }),
        createDepartment({ code: 'DEP1' }),
        createDepartment({ code: 'DEP2' }),
        createRegulation({ name: 'R2033', startYear: 2033 })
      ]);

      await BatchProgram.create({
        batchId: batch._id,
        departmentId: depA._id,
        regulationId: reg._id
      });

      const target = await BatchProgram.create({
        batchId: batch._id,
        departmentId: depB._id,
        regulationId: reg._id
      });

      const res = await request(app)
        .put(`/api/batch-programs/${target._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId: String(depA._id) });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'This department is already mapped to this batch'
      );
    });

    test('should update batch program successfully', async () => {
      const token = await createAdminToken();
      const [batchA, batchB] = await Promise.all([
        createBatch({ startYear: 2034, endYear: 2038, name: '2034-2038' }),
        createBatch({ startYear: 2035, endYear: 2039, name: '2035-2039' })
      ]);
      const [depA, depB] = await Promise.all([
        createDepartment({ code: 'UPA' }),
        createDepartment({ code: 'UPB' })
      ]);
      const [regA, regB] = await Promise.all([
        createRegulation({ name: 'R2034', startYear: 2034 }),
        createRegulation({ name: 'R2035', startYear: 2035 })
      ]);

      const batchProgram = await BatchProgram.create({
        batchId: batchA._id,
        departmentId: depA._id,
        regulationId: regA._id
      });

      const res = await request(app)
        .put(`/api/batch-programs/${batchProgram._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchId: String(batchB._id),
          departmentId: String(depB._id),
          regulationId: String(regB._id)
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('BatchProgram updated successfully');
      expect(res.body.data.batchProgram.batchId._id).toBe(String(batchB._id));
      expect(res.body.data.batchProgram.departmentId._id).toBe(
        String(depB._id)
      );
      expect(res.body.data.batchProgram.regulationId._id).toBe(
        String(regB._id)
      );
    });
  });

  describe('DELETE /api/batch-programs/:id', () => {
    test('should fail with invalid id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/batch-programs/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid BatchProgram id');
    });

    test('should return 404 for missing mapping', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/batch-programs/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('BatchProgram not found');
    });

    test('should delete mapping successfully', async () => {
      const token = await createAdminToken();
      const [batch, department, regulation] = await Promise.all([
        createBatch({ startYear: 2036, endYear: 2040, name: '2036-2040' }),
        createDepartment({ code: 'DEL' }),
        createRegulation({ name: 'R2036', startYear: 2036 })
      ]);

      const batchProgram = await BatchProgram.create({
        batchId: batch._id,
        departmentId: department._id,
        regulationId: regulation._id
      });

      const res = await request(app)
        .delete(`/api/batch-programs/${batchProgram._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('BatchProgram deleted successfully');
      expect(res.body.data).toEqual({});

      const deleted = await BatchProgram.findById(batchProgram._id);
      expect(deleted).toBeNull();
    });
  });
});
