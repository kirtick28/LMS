import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import Department from '../models/Department.js';
import Batch from '../models/Batch.js';
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

describe('Master Data APIs', () => {
  describe('Department API', () => {
    it('creates department for admin and auto-normalizes code', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-dept-create');

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Computer Science and Engineering',
          shortName: 'CSE',
          program: 'B.E'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.department.name).toBe('Computer Science and Engineering');
      expect(res.body.department.code).toBe('CSE');
    });

    it('rejects department create for non-admin', async () => {
      const token = await getTokenByRole('FACULTY', 'faculty-dept-denied');

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'EEE', code: 'EEE' });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });
  });

  describe('Batch API', () => {
    it('creates batch with default UNALLOCATED section', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-batch-create');

      const department = await Department.create({
        name: `Dept-${uniqueId()}`,
        code: `D${uniqueId()}`
      });

      const regulation = await Regulation.create({
        name: `R${2030 + seq}`,
        startYear: 2030,
        totalSemesters: 8
      });

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: department._id,
          startYear: 2023,
          endYear: 2027,
          regulationId: regulation._id
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.batch.departmentId.toString()).toBe(
        department._id.toString()
      );

      const section = await Section.findOne({
        batchId: res.body.batch._id,
        name: 'UNALLOCATED'
      });

      expect(section).toBeTruthy();
    });

    it('returns 400 for invalid regulationId', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-batch-invalid-reg');
      const department = await Department.create({
        name: `Dept-${uniqueId()}`,
        code: `E${uniqueId()}`
      });

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: department._id,
          admissionYear: 2023,
          regulationId: new mongoose.Types.ObjectId()
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Invalid regulationId');
    });
  });

  describe('Section API', () => {
    it('creates section with capacity', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-section-create');

      const department = await Department.create({
        name: `Dept-${uniqueId()}`,
        code: `S${uniqueId()}`
      });

      const batch = await Batch.create({
        name: `2024-${uniqueId()}`,
        departmentId: department._id,
        admissionYear: 2024,
        graduationYear: 2028,
        startYear: 2024,
        endYear: 2028,
        programDuration: 4
      });

      const res = await request(app)
        .post('/api/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'A', batchId: batch._id, capacity: 65 });

      expect(res.statusCode).toBe(201);
      expect(res.body.section.name).toBe('A');
      expect(res.body.section.capacity).toBe(65);
    });

    it('prevents duplicate section within same batch', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-section-dup');

      const department = await Department.create({
        name: `Dept-${uniqueId()}`,
        code: `T${uniqueId()}`
      });

      const batch = await Batch.create({
        name: `2025-${uniqueId()}`,
        departmentId: department._id,
        admissionYear: 2025,
        graduationYear: 2029,
        startYear: 2025,
        endYear: 2029,
        programDuration: 4
      });

      await Section.create({ name: 'B', batchId: batch._id });

      const res = await request(app)
        .post('/api/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'b', batchId: batch._id });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Section already exists in this batch');
    });
  });

  describe('Regulation API', () => {
    it('creates regulation and lists it', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-regulation-create');

      const createRes = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `R${2040 + seq}`, startYear: 2040, totalSemesters: 8 });

      expect(createRes.statusCode).toBe(201);

      const listRes = await request(app)
        .get('/api/regulations')
        .set('Authorization', `Bearer ${token}`);

      expect(listRes.statusCode).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBe(1);
    });
  });

  describe('Curriculum API', () => {
    it('creates curriculum with semester-subject mapping', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-curriculum-create');

      const department = await Department.create({
        name: `Dept-${uniqueId()}`,
        code: `C${uniqueId()}`
      });

      const regulation = await Regulation.create({
        name: `R${2050 + seq}`,
        startYear: 2050,
        totalSemesters: 8
      });

      const subject = await Subject.create({
        name: 'Mathematics I',
        code: `MATH-${uniqueId()}`,
        credits: 4,
        courseType: 'T',
        departmentId: department._id,
        regulationId: regulation._id,
        isActive: true
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: department._id,
          regulationId: regulation._id,
          semesters: [
            {
              semesterNumber: 1,
              subjects: [{ subjectId: subject._id }]
            }
          ]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.curriculum.semesters.length).toBe(1);
      expect(res.body.curriculum.semesters[0].semesterNumber).toBe(1);
    });

    it('returns 400 for invalid subject in semester mapping', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-curriculum-invalid');

      const department = await Department.create({
        name: `Dept-${uniqueId()}`,
        code: `V${uniqueId()}`
      });

      const regulation = await Regulation.create({
        name: `R${2060 + seq}`,
        startYear: 2060,
        totalSemesters: 8
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: department._id,
          regulationId: regulation._id,
          semesters: [
            {
              semesterNumber: 1,
              subjects: [{ subjectId: new mongoose.Types.ObjectId() }]
            }
          ]
        });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe('One or more subjects do not exist');
    });
  });
});
