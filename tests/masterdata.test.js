import request from 'supertest';
import mongoose from 'mongoose';
import xlsx from 'xlsx';
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
    it('creates department with normalized code', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-dept');
      const departmentCode = `CS${seq}X`;
      const departmentName = `Computer Science ${uniqueId()}`;

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: departmentName,
          code: ` ${departmentCode.toLowerCase()} `,
          program: 'B.E.'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.department.code).toBe(departmentCode);
    });

    it('rejects duplicate department code', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-dept-dup');

      await Department.create({
        name: `Department-${uniqueId()}`,
        code: 'MECH'
      });

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Department-${uniqueId()}`,
          code: 'mech'
        });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('Regulation API', () => {
    it('creates regulation and rejects duplicate startYear', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-reg');

      const createRes = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `R${2100 + seq}`,
          startYear: 2100,
          totalSemesters: 8
        });

      expect(createRes.statusCode).toBe(201);

      const duplicateRes = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `R${2101 + seq}`,
          startYear: 2100,
          totalSemesters: 8
        });

      expect(duplicateRes.statusCode).toBe(409);
    });
  });

  describe('Batch API', () => {
    it('creates batch and auto-creates UNALLOCATED section', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-batch');

      const [department, regulation] = await Promise.all([
        Department.create({ name: `Dept-${uniqueId()}`, code: `D${seq}X` }),
        Regulation.create({ name: `R${2200 + seq}`, startYear: 2200 })
      ]);

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: department._id,
          startYear: 2024,
          endYear: 2028,
          regulationId: regulation._id
        });

      expect(res.statusCode).toBe(201);

      const unallocated = await Section.findOne({
        batchId: res.body.batch._id,
        name: 'UNALLOCATED'
      });

      expect(unallocated).toBeTruthy();
    });

    it('returns 400 for missing regulationId', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-batch-missing-reg');
      const department = await Department.create({
        name: `Dept-${uniqueId()}`,
        code: `DM${seq}X`
      });

      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: department._id,
          startYear: 2024,
          endYear: 2028
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/regulationId/i);
    });
  });

  describe('Section API', () => {
    it('prevents duplicate section name in same batch (case-insensitive)', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-section-dup');

      const [department, regulation] = await Promise.all([
        Department.create({ name: `Dept-${uniqueId()}`, code: `S${seq}X` }),
        Regulation.create({ name: `R${2300 + seq}`, startYear: 2300 })
      ]);

      const batch = await Batch.create({
        departmentId: department._id,
        regulationId: regulation._id,
        startYear: 2025,
        endYear: 2029
      });

      await Section.create({ name: 'A', batchId: batch._id });

      const res = await request(app)
        .post('/api/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'a', batchId: batch._id });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe('Section already exists in this batch');
    });
  });

  describe('Curriculum API', () => {
    it('creates curriculum and rejects invalid subject reference', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-curriculum');

      const [department, regulation] = await Promise.all([
        Department.create({ name: `Dept-${uniqueId()}`, code: `C${seq}X` }),
        Regulation.create({ name: `R${2400 + seq}`, startYear: 2400 })
      ]);

      const subject = await Subject.create({
        name: `Math-${uniqueId()}`,
        code: `M${2400 + seq}`,
        credits: 4,
        courseType: 'T',
        departmentId: department._id
      });

      const createRes = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: department._id,
          regulationId: regulation._id,
          semesters: [
            { semesterNumber: 1, subjects: [{ subjectId: subject._id }] }
          ]
        });

      expect(createRes.statusCode).toBe(201);

      const regulation2 = await Regulation.create({
        name: `R${2450 + seq}`,
        startYear: 2450
      });

      const invalidSubjectRes = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: department._id,
          regulationId: regulation2._id,
          semesters: [
            {
              semesterNumber: 2,
              subjects: [{ subjectId: new mongoose.Types.ObjectId() }]
            }
          ]
        });

      expect(invalidSubjectRes.statusCode).toBe(400);

      const duplicatePair = await Curriculum.findOne({
        departmentId: department._id,
        regulationId: regulation._id
      });
      expect(duplicatePair).toBeTruthy();
    });

    it('returns 400 for invalid semester payload in update', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-curriculum-update');

      const [department, regulation] = await Promise.all([
        Department.create({ name: `Dept-${uniqueId()}`, code: `U${seq}X` }),
        Regulation.create({ name: `R${2500 + seq}`, startYear: 2500 })
      ]);

      const curriculum = await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: []
      });

      const res = await request(app)
        .put(`/api/curriculums/${curriculum._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          semesters: [{ semesterNumber: 0, subjects: [] }]
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/semesterNumber/i);
    });
  });

  describe('Subject API', () => {
    it('returns 400 when subject upload file is missing', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-subject-upload-400');

      const department = await Department.create({
        name: `Dept-${uniqueId()}`,
        code: `SM${seq}X`
      });

      const res = await request(app)
        .post('/api/subjects/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('departmentId', String(department._id));

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('No file uploaded');
    });

    it('uploads subjects and reports inserted/skipped/failed counts', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-subject-upload-200');

      const department = await Department.create({
        name: `Dept-${uniqueId()}`,
        code: `SB${seq}X`
      });

      const rows = [
        {
          name: 'Linear Algebra',
          code: 'MA3001',
          credits: 4,
          courseType: 'T'
        },
        {
          name: 'Linear Algebra',
          code: 'MA3999',
          credits: 4,
          courseType: 'T'
        },
        {
          name: 'Broken Row'
        }
      ];

      const workbook = xlsx.utils.book_new();
      const sheet = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, sheet, 'Subjects');
      const excelBuffer = xlsx.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      });

      const res = await request(app)
        .post('/api/subjects/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('departmentId', String(department._id))
        .attach('file', excelBuffer, 'subjects-upload.xlsx');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inserted).toBe(1);
      expect(res.body.data.skipped).toBe(1);
      expect(res.body.data.failed).toBe(1);

      const created = await Subject.findOne({ code: 'MA3001' });
      expect(created).toBeTruthy();
    });

    it('uploads subjects when departmentId is provided in params', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-subject-upload-param');

      const department = await Department.create({
        name: `Dept-${uniqueId()}`,
        code: `SP${seq}X`
      });

      const rows = [
        {
          name: 'Probability and Statistics',
          code: 'MA3002',
          credits: 4,
          courseType: 'T'
        }
      ];

      const workbook = xlsx.utils.book_new();
      const sheet = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, sheet, 'Subjects');
      const excelBuffer = xlsx.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      });

      const res = await request(app)
        .post(`/api/subjects/upload/${department._id}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', excelBuffer, 'subjects-upload-param.xlsx');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inserted).toBe(1);
      expect(res.body.data.skipped).toBe(0);
      expect(res.body.data.failed).toBe(0);
    });
  });
});
