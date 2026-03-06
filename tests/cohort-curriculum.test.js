import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import Department from '../models/Department.js';
import Batch from '../models/Batch.js';
import BatchProgram from '../models/BatchProgram.js';
import Section from '../models/Section.js';
import Regulation from '../models/Regulation.js';
import Curriculum from '../models/Curriculum.js';
import Subject from '../models/Subject.js';

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

describe('Cohort and Curriculum APIs', () => {
  describe('Batch API (Global)', () => {
    it('creates a global batch without department dependency', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-batch-global');

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2024,
          programDuration: 4,
          name: '2024-2028'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batch.endYear).toBe(2028);
    });
  });

  describe('BatchProgram API (The Junction)', () => {
    it('maps a department to a regulation for a batch', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-bp');

      const [batch, department, regulation] = await Promise.all([
        Batch.create({ startYear: 2023, endYear: 2027, name: '2023-27' }),
        Department.create({ name: `Dept BP ${uniqueId()}`, code: `DBP${seq}` }),
        Regulation.create({ name: `R${2600 + seq}`, startYear: 2600 })
      ]);

      const res = await request(app)
        .post('/api/batch-programs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchId: batch._id,
          departmentId: department._id,
          regulationId: regulation._id
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batchProgram.batchId._id).toBe(batch._id.toString());
    });

    it('prevents duplicate department mapping in the same batch', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-bp-dup');

      const batch = await Batch.create({ startYear: 2025, endYear: 2029 });
      const dept = await Department.create({
        name: 'Duplicate Test',
        code: 'DUP'
      });
      const reg = await Regulation.create({ name: 'R-DUP', startYear: 2025 });

      await BatchProgram.create({
        batchId: batch._id,
        departmentId: dept._id,
        regulationId: reg._id
      });

      const res = await request(app)
        .post('/api/batch-programs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchId: batch._id,
          departmentId: dept._id,
          regulationId: reg._id
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toMatch(/already mapped/i);
    });
  });

  describe('Section API', () => {
    it('creates a section pointing to a BatchProgram', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-section-bp');

      const batch = await Batch.create({ startYear: 2024, endYear: 2028 });
      const dept = await Department.create({ name: 'CSE', code: 'CSE' });
      const reg = await Regulation.create({ name: 'R2024', startYear: 2024 });
      const bp = await BatchProgram.create({
        batchId: batch._id,
        departmentId: dept._id,
        regulationId: reg._id
      });

      const res = await request(app)
        .post('/api/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'A',
          batchProgramId: bp._id,
          capacity: 60
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.section.name).toBe('A');
      expect(res.body.data.section.batchProgramId).toBe(bp._id.toString());
    });
  });

  describe('Curriculum API (Nested Semesters)', () => {
    it('creates curriculum with nested semesters and subjects', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-curr-nested');

      const dept = await Department.create({ name: 'IT', code: 'IT' });
      const reg = await Regulation.create({ name: 'R-IT', startYear: 2025 });
      const sub = await Subject.create({
        name: 'Web Tech',
        code: 'WT101',
        departmentId: dept._id
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: dept._id,
          regulationId: reg._id,
          semesters: [
            {
              semesterNumber: 1,
              subjects: [sub._id]
            }
          ]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.curriculum.semesters[0].semesterNumber).toBe(1);
      expect(res.body.data.curriculum.semesters[0].subjects[0]).toBe(
        sub._id.toString()
      );
    });

    it('rejects curriculum with duplicate semester numbers', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-curr-dup-sem');

      const dept = await Department.create({ name: 'Mech', code: 'ME' });
      const reg = await Regulation.create({ name: 'R-ME', startYear: 2025 });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: dept._id,
          regulationId: reg._id,
          semesters: [
            { semesterNumber: 1, subjects: [] },
            { semesterNumber: 1, subjects: [] }
          ]
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Duplicate semesterNumber/i);
    });

    it('rejects curriculum if subjects do not exist', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-curr-fake-sub');

      const dept = await Department.create({ name: 'Civil', code: 'CE' });
      const reg = await Regulation.create({ name: 'R-CE', startYear: 2025 });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: dept._id,
          regulationId: reg._id,
          semesters: [
            {
              semesterNumber: 1,
              subjects: [new mongoose.Types.ObjectId()]
            }
          ]
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/subjects do not exist/i);
    });
  });
});
