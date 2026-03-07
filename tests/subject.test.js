import jwt from 'jsonwebtoken';
import request from 'supertest';
import xlsx from 'xlsx';

import app from '../app.js';
import Department from '../models/Department.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';

describe('Subject API', () => {
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

  const createDepartment = async (overrides = {}) => {
    return await Department.create({
      name: overrides.name || `Department-${Date.now()}-${Math.random()}`,
      code: overrides.code || `D${Math.floor(Math.random() * 100000)}`,
      program: overrides.program || 'B.E.',
      isActive:
        typeof overrides.isActive === 'boolean' ? overrides.isActive : true
    });
  };

  const createWorkbookBuffer = (rows) => {
    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Subjects');
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  };

  describe('POST /api/subjects', () => {
    test('should create subject successfully and populate department', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({
        name: 'Computer Science and Engineering',
        code: 'CSE'
      });

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Data Structures',
          code: ' cs301 ',
          credits: 4,
          courseType: 'TP',
          departmentId: String(department._id),
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Subject created successfully');
      expect(res.body.data.subject.name).toBe('Data Structures');
      expect(res.body.data.subject.code).toBe('CS301');
      expect(res.body.data.subject.courseType).toBe('TP');
      expect(res.body.data.subject.departmentId._id).toBe(
        String(department._id)
      );
      expect(res.body.data.subject.departmentId.name).toBe(
        'Computer Science and Engineering'
      );
    });

    test('should fail without token', async () => {
      const department = await createDepartment();

      const res = await request(app)
        .post('/api/subjects')
        .send({
          name: 'Operating Systems',
          code: 'CS302',
          departmentId: String(department._id)
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const token = await createFacultyToken();
      const department = await createDepartment();

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Computer Networks',
          code: 'CS303',
          departmentId: String(department._id)
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail when required fields are missing', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'CS304' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('name, code and departmentId are required');
    });

    test('should fail when departmentId is invalid', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Compiler Design',
          code: 'CS305',
          departmentId: 'not-an-id'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid departmentId');
    });

    test('should fail when department does not exist', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Theory of Computation',
          code: 'CS306',
          departmentId: '507f1f77bcf86cd799439011'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Department not found');
    });

    test('should fail on duplicate code', async () => {
      const token = await createAdminToken();
      const department = await createDepartment();

      await Subject.create({
        name: 'Existing Subject',
        code: 'CS307',
        departmentId: department._id
      });

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Another Subject',
          code: 'cs307',
          departmentId: String(department._id)
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Subject with same code or same name in department already exists'
      );
    });

    test('should fail on duplicate name within same department', async () => {
      const token = await createAdminToken();
      const department = await createDepartment();

      await Subject.create({
        name: 'Database Management Systems',
        code: 'CS308',
        departmentId: department._id
      });

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Database Management Systems',
          code: 'CS309',
          departmentId: String(department._id)
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Subject with same code or same name in department already exists'
      );
    });

    test('should allow same name in different departments', async () => {
      const token = await createAdminToken();
      const dep1 = await createDepartment({ code: 'CSE1' });
      const dep2 = await createDepartment({ code: 'ECE1' });

      await Subject.create({
        name: 'Linear Algebra',
        code: 'MA100',
        departmentId: dep1._id
      });

      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Linear Algebra',
          code: 'MA101',
          departmentId: String(dep2._id)
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/subjects', () => {
    test('should fail without token', async () => {
      const res = await request(app).get('/api/subjects');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should allow authenticated non-admin user', async () => {
      const token = await createFacultyToken();
      const res = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.subjects)).toBe(true);
    });

    test('should fail on invalid departmentId query', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/subjects?departmentId=invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid departmentId');
    });

    test('should filter by departmentId, courseType and isActive', async () => {
      const token = await createAdminToken();
      const depA = await createDepartment({ code: 'DA01' });
      const depB = await createDepartment({ code: 'DB01' });

      await Subject.create({
        name: 'Filter Match',
        code: 'FM101',
        courseType: 'TP',
        isActive: true,
        departmentId: depA._id
      });
      await Subject.create({
        name: 'Wrong Course Type',
        code: 'FM102',
        courseType: 'T',
        isActive: true,
        departmentId: depA._id
      });
      await Subject.create({
        name: 'Wrong Department',
        code: 'FM103',
        courseType: 'TP',
        isActive: true,
        departmentId: depB._id
      });
      await Subject.create({
        name: 'Inactive Match',
        code: 'FM104',
        courseType: 'TP',
        isActive: false,
        departmentId: depA._id
      });

      const res = await request(app)
        .get(
          `/api/subjects?departmentId=${depA._id}&courseType=tp&isActive=true`
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subjects).toHaveLength(1);
      expect(res.body.data.subjects[0].name).toBe('Filter Match');
    });

    test('should return subjects sorted by code then name', async () => {
      const token = await createAdminToken();
      const dep = await createDepartment();

      await Subject.create({
        name: 'Beta',
        code: 'ZZ100',
        departmentId: dep._id
      });
      await Subject.create({
        name: 'Alpha',
        code: 'AA100',
        departmentId: dep._id
      });

      const res = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const [first, second] = res.body.data.subjects;
      expect(first.code).toBe('AA100');
      expect(second.code).toBe('ZZ100');
    });
  });

  describe('GET /api/subjects/:id', () => {
    test('should fail with invalid subject id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/subjects/not-a-valid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid subject id');
    });

    test('should return 404 for missing subject', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/subjects/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Subject not found');
    });

    test('should get subject by id', async () => {
      const token = await createAdminToken();
      const dep = await createDepartment({ name: 'EEE', code: 'EEE' });
      const subject = await Subject.create({
        name: 'Power Systems',
        code: 'EE401',
        departmentId: dep._id
      });

      const res = await request(app)
        .get(`/api/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subject._id).toBe(String(subject._id));
      expect(res.body.data.subject.departmentId._id).toBe(String(dep._id));
    });
  });

  describe('PUT /api/subjects/:id', () => {
    test('should fail without token', async () => {
      const dep = await createDepartment();
      const subject = await Subject.create({
        name: 'Signals and Systems',
        code: 'EC401',
        departmentId: dep._id
      });

      const res = await request(app)
        .put(`/api/subjects/${subject._id}`)
        .send({ name: 'Signals Updated' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin', async () => {
      const token = await createFacultyToken();
      const dep = await createDepartment();
      const subject = await Subject.create({
        name: 'Embedded Systems',
        code: 'EC402',
        departmentId: dep._id
      });

      const res = await request(app)
        .put(`/api/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Embedded Updated' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail with invalid subject id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/subjects/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Invalid Test' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid subject id');
    });

    test('should return 404 when subject not found', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/subjects/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Not Found Subject' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Subject not found');
    });

    test('should fail with invalid departmentId during update', async () => {
      const token = await createAdminToken();
      const dep = await createDepartment();
      const subject = await Subject.create({
        name: 'Microprocessors',
        code: 'EC403',
        departmentId: dep._id
      });

      const res = await request(app)
        .put(`/api/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId: 'bad-id' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid departmentId');
    });

    test('should fail when update department does not exist', async () => {
      const token = await createAdminToken();
      const dep = await createDepartment();
      const subject = await Subject.create({
        name: 'Digital Signal Processing',
        code: 'EC404',
        departmentId: dep._id
      });

      const res = await request(app)
        .put(`/api/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId: '507f1f77bcf86cd799439011' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Department not found');
    });

    test('should fail on duplicate code/name conflicts', async () => {
      const token = await createAdminToken();
      const dep = await createDepartment({ code: 'DUP01' });

      const first = await Subject.create({
        name: 'First Subject',
        code: 'DUP100',
        departmentId: dep._id
      });
      await Subject.create({
        name: 'Second Subject',
        code: 'DUP200',
        departmentId: dep._id
      });

      const res = await request(app)
        .put(`/api/subjects/${first._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'dup200' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'Subject with same code or same name in department already exists'
      );
    });

    test('should update subject successfully', async () => {
      const token = await createAdminToken();
      const dep1 = await createDepartment({ code: 'UPD01' });
      const dep2 = await createDepartment({ code: 'UPD02' });

      const subject = await Subject.create({
        name: 'Old Subject',
        code: 'UPD100',
        credits: 3,
        courseType: 'T',
        departmentId: dep1._id,
        isActive: true
      });

      const res = await request(app)
        .put(`/api/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '  Updated Subject  ',
          code: ' upd200 ',
          credits: 5,
          courseType: 'PJ',
          departmentId: String(dep2._id),
          isActive: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Subject updated successfully');
      expect(res.body.data.subject.name).toBe('Updated Subject');
      expect(res.body.data.subject.code).toBe('UPD200');
      expect(res.body.data.subject.credits).toBe(5);
      expect(res.body.data.subject.courseType).toBe('PJ');
      expect(res.body.data.subject.departmentId._id).toBe(String(dep2._id));
      expect(res.body.data.subject.isActive).toBe(false);
    });

    test('should fail on invalid courseType enum', async () => {
      const token = await createAdminToken();
      const dep = await createDepartment();
      const subject = await Subject.create({
        name: 'Machine Learning',
        code: 'AI401',
        departmentId: dep._id
      });

      const res = await request(app)
        .put(`/api/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ courseType: 'LAB' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid input data');
    });
  });

  describe('DELETE /api/subjects/:id', () => {
    test('should fail with invalid subject id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/subjects/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid subject id');
    });

    test('should return 404 for missing subject', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/subjects/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Subject not found');
    });

    test('should delete subject successfully', async () => {
      const token = await createAdminToken();
      const dep = await createDepartment();
      const subject = await Subject.create({
        name: 'Delete Me',
        code: 'DEL100',
        departmentId: dep._id
      });

      const res = await request(app)
        .delete(`/api/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Subject deleted successfully');

      const deleted = await Subject.findById(subject._id);
      expect(deleted).toBeNull();
    });
  });

  describe('POST /api/subjects/upload', () => {
    test('should fail when file is missing', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/subjects/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('departmentId', '507f1f77bcf86cd799439011');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('No file uploaded');
    });

    test('should fail when departmentId is not provided in params/body', async () => {
      const token = await createAdminToken();
      const file = createWorkbookBuffer([{ name: 'Subject A', code: 'UP101' }]);

      const res = await request(app)
        .post('/api/subjects/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', file, 'subjects.xlsx');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'departmentId is required in params or body'
      );
    });

    test('should fail when departmentId is invalid', async () => {
      const token = await createAdminToken();
      const file = createWorkbookBuffer([{ name: 'Subject B', code: 'UP102' }]);

      const res = await request(app)
        .post('/api/subjects/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('departmentId', 'invalid-id')
        .attach('file', file, 'subjects.xlsx');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid departmentId');
    });

    test('should upload from body departmentId and return inserted/skipped/failed', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'UPL01' });

      await Subject.create({
        name: 'Existing Row',
        code: 'UP103',
        departmentId: department._id
      });

      const file = createWorkbookBuffer([
        {
          name: 'Operating Systems',
          code: 'UP104',
          credits: 4,
          courseType: 'T'
        },
        { name: 'Existing Row', code: 'UP103', credits: 3, courseType: 'P' },
        { name: '', code: 'UP105' }
      ]);

      const res = await request(app)
        .post('/api/subjects/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('departmentId', String(department._id))
        .attach('file', file, 'subjects.xlsx');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Upload completed');
      expect(res.body.data).toEqual({
        inserted: 1,
        skipped: 1,
        failed: 1
      });
    });

    test('should upload using /upload/:departmentId path param', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'UPL02' });
      const file = createWorkbookBuffer([
        {
          name: 'Software Engineering',
          code: 'UP106',
          credits: 3,
          courseType: 'TP'
        }
      ]);

      const res = await request(app)
        .post(`/api/subjects/upload/${department._id}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', file, 'subjects.xlsx');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inserted).toBe(1);
      expect(res.body.data.skipped).toBe(0);
      expect(res.body.data.failed).toBe(0);

      const saved = await Subject.findOne({ code: 'UP106' });
      expect(saved).toBeTruthy();
      expect(String(saved.departmentId)).toBe(String(department._id));
    });
  });
});
