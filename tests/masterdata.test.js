import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import Department from '../models/Department.js';
import Regulation from '../models/Regulation.js';
import Subject from '../models/Subject.js';
import AcademicYear from '../models/AcademicYear.js';

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

describe('Master Academic Data APIs', () => {
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
      expect(res.body.success).toBe(false);
    });
  });

  describe('Regulation API (Global)', () => {
    it('creates a global regulation and formats name automatically', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-reg');

      const res = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2025,
          totalSemesters: 8
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.regulation.name).toBe('R2025');
    });

    it('rejects duplicate global regulation name', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-reg-dup');

      const createRes = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `R${2100 + seq}`,
          startYear: 2100
        });

      expect(createRes.statusCode).toBe(201);

      const duplicateRes = await request(app)
        .post('/api/regulations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `r${2100 + seq}`,
          startYear: 2101
        });

      expect(duplicateRes.statusCode).toBe(409);
      expect(duplicateRes.body.success).toBe(false);
    });
  });

  describe('Subject API', () => {
    it('creates a subject under a specific department', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-sub');

      const department = await Department.create({
        name: `Dept Sub ${uniqueId()}`,
        code: `DS${seq}`
      });

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Data Structures',
          code: `CS${uniqueId()}`,
          credits: 4,
          courseType: 'T',
          departmentId: department._id
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subject.courseType).toBe('T');
    });

    it('rejects subject creation with invalid departmentId', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-sub-inv');

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Algorithms',
          code: 'CS400',
          departmentId: new mongoose.Types.ObjectId()
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('AcademicYear API', () => {
    it('creates academic year and auto-formats the name', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-ay');

      const res = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2025,
          endYear: 2026,
          startDate: '2025-07-01',
          endDate: '2026-05-30',
          isActive: false
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.academicYear.name).toBe('2025-26');
    });

    it('toggles active state so only one academic year is active at a time', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-ay-toggle');

      const ay1 = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2026,
          endYear: 2027,
          startDate: '2026-07-01',
          endDate: '2027-05-30',
          isActive: true
        });

      expect(ay1.body.data.academicYear.isActive).toBe(true);

      const ay2 = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2027,
          endYear: 2028,
          startDate: '2027-07-01',
          endDate: '2028-05-30',
          isActive: true
        });

      expect(ay2.body.data.academicYear.isActive).toBe(true);

      const checkAy1 = await AcademicYear.findById(
        ay1.body.data.academicYear._id
      );
      expect(checkAy1.isActive).toBe(false);
    });

    it('rejects creation if endYear is less than startYear', async () => {
      const token = await getTokenByRole('ADMIN', 'admin-ay-dates');

      const res = await request(app)
        .post('/api/academic-years')
        .set('Authorization', `Bearer ${token}`)
        .send({
          startYear: 2025,
          endYear: 2024,
          startDate: '2025-07-01',
          endDate: '2024-05-30'
        });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(
        /endYear must be greater than startYear/i
      );
    });
  });
});
