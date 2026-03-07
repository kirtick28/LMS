import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../app.js';
import Curriculum from '../models/Curriculum.js';
import Department from '../models/Department.js';
import Regulation from '../models/Regulation.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';

describe('Curriculum API', () => {
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

  const createRegulation = async (overrides = {}) => {
    return await Regulation.create({
      name: overrides.name || `R${Math.floor(Math.random() * 100000)}`,
      startYear: overrides.startYear || 2026,
      totalSemesters:
        overrides.totalSemesters === undefined ? 8 : overrides.totalSemesters,
      isActive:
        typeof overrides.isActive === 'boolean' ? overrides.isActive : true
    });
  };

  const createSubject = async (departmentId, overrides = {}) => {
    return await Subject.create({
      name: overrides.name || `Subject-${Date.now()}-${Math.random()}`,
      code: overrides.code || `S${Math.floor(Math.random() * 100000)}`,
      credits: overrides.credits === undefined ? 3 : overrides.credits,
      courseType: overrides.courseType || 'T',
      departmentId,
      isActive:
        typeof overrides.isActive === 'boolean' ? overrides.isActive : true
    });
  };

  describe('POST /api/curriculums', () => {
    test('should create curriculum successfully', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'CSE' });
      const regulation = await createRegulation({
        name: 'R2026',
        startYear: 2026
      });
      const sub1 = await createSubject(department._id, { code: 'CS101' });
      const sub2 = await createSubject(department._id, { code: 'CS102' });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: String(department._id),
          regulationId: String(regulation._id),
          semesters: [
            {
              semesterNumber: 1,
              subjects: [String(sub1._id), String(sub2._id)]
            }
          ],
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Curriculum created successfully');
      expect(res.body.data.curriculum.departmentId).toBe(
        String(department._id)
      );
      expect(res.body.data.curriculum.regulationId).toBe(
        String(regulation._id)
      );
      expect(res.body.data.curriculum.semesters).toHaveLength(1);
      expect(res.body.data.curriculum.semesters[0].semesterNumber).toBe(1);
      expect(res.body.data.curriculum.semesters[0].subjects).toHaveLength(2);
    });

    test('should fail without token', async () => {
      const res = await request(app).post('/api/curriculums').send({});

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const token = await createFacultyToken();
      const department = await createDepartment({ code: 'EEE' });
      const regulation = await createRegulation({
        name: 'R2027',
        startYear: 2027
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: String(department._id),
          regulationId: String(regulation._id)
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail when departmentId or regulationId is missing', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(
        'departmentId and regulationId are required'
      );
    });

    test('should fail when departmentId is invalid', async () => {
      const token = await createAdminToken();
      const regulation = await createRegulation({
        name: 'R2028',
        startYear: 2028
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: 'invalid-id',
          regulationId: String(regulation._id)
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid departmentId');
    });

    test('should fail when regulationId is invalid', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'MECH' });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: String(department._id),
          regulationId: 'invalid-id'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid regulationId');
    });

    test('should fail when department does not exist', async () => {
      const token = await createAdminToken();
      const regulation = await createRegulation({
        name: 'R2029',
        startYear: 2029
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: '507f1f77bcf86cd799439011',
          regulationId: String(regulation._id)
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Department not found');
    });

    test('should fail when regulation does not exist', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'CIV' });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: String(department._id),
          regulationId: '507f1f77bcf86cd799439011'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Regulation not found');
    });

    test('should fail when semesters is not an array', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'IT' });
      const regulation = await createRegulation({
        name: 'R2030',
        startYear: 2030
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: String(department._id),
          regulationId: String(regulation._id),
          semesters: 'not-an-array'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('semesters must be an array');
    });

    test('should fail when duplicate semester numbers exist', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'ECE' });
      const regulation = await createRegulation({
        name: 'R2031',
        startYear: 2031
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: String(department._id),
          regulationId: String(regulation._id),
          semesters: [
            { semesterNumber: 1, subjects: [] },
            { semesterNumber: 1, subjects: [] }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Duplicate semesterNumber');
    });

    test('should fail when semester subject id is invalid', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'AGRI' });
      const regulation = await createRegulation({
        name: 'R2032',
        startYear: 2032
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: String(department._id),
          regulationId: String(regulation._id),
          semesters: [{ semesterNumber: 1, subjects: ['bad-subject-id'] }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid subjectId in semesters');
    });

    test('should fail when semester subject does not exist', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'BIO' });
      const regulation = await createRegulation({
        name: 'R2033',
        startYear: 2033
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: String(department._id),
          regulationId: String(regulation._id),
          semesters: [
            { semesterNumber: 1, subjects: ['507f1f77bcf86cd799439011'] }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('One or more subjects do not exist');
    });

    test('should fail when curriculum already exists for department and regulation', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'AUTO' });
      const regulation = await createRegulation({
        name: 'R2034',
        startYear: 2034
      });

      await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: []
      });

      const res = await request(app)
        .post('/api/curriculums')
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: String(department._id),
          regulationId: String(regulation._id)
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'Curriculum already exists for this department and regulation'
      );
    });
  });

  describe('GET /api/curriculums', () => {
    test('should fail without token', async () => {
      const res = await request(app).get('/api/curriculums');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should allow authenticated non-admin user', async () => {
      const token = await createFacultyToken();

      const res = await request(app)
        .get('/api/curriculums')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.curriculums)).toBe(true);
    });

    test('should return populated curriculum data', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({
        name: 'Computer Science',
        code: 'CS'
      });
      const regulation = await createRegulation({
        name: 'R2035',
        startYear: 2035
      });
      const subject = await createSubject(department._id, {
        name: 'Algorithms',
        code: 'CS501'
      });

      await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: [{ semesterNumber: 1, subjects: [subject._id] }]
      });

      const res = await request(app)
        .get('/api/curriculums')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.curriculums).toHaveLength(1);
      expect(res.body.data.curriculums[0].departmentId.name).toBe(
        'Computer Science'
      );
      expect(res.body.data.curriculums[0].regulationId.name).toBe('R2035');
      expect(res.body.data.curriculums[0].semesters[0].subjects[0].name).toBe(
        'Algorithms'
      );
    });

    test('should filter by departmentId, regulationId, and isActive', async () => {
      const token = await createAdminToken();
      const depA = await createDepartment({ code: 'A1' });
      const depB = await createDepartment({ code: 'B1' });
      const regA = await createRegulation({ name: 'R2036', startYear: 2036 });
      const regB = await createRegulation({ name: 'R2037', startYear: 2037 });

      await Curriculum.create({
        departmentId: depA._id,
        regulationId: regA._id,
        semesters: [],
        isActive: true
      });
      await Curriculum.create({
        departmentId: depA._id,
        regulationId: regB._id,
        semesters: [],
        isActive: false
      });
      await Curriculum.create({
        departmentId: depB._id,
        regulationId: regA._id,
        semesters: [],
        isActive: true
      });

      const res = await request(app)
        .get(
          `/api/curriculums?departmentId=${depA._id}&regulationId=${regA._id}&isActive=true`
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.curriculums).toHaveLength(1);
      expect(res.body.data.curriculums[0].departmentId._id).toBe(
        String(depA._id)
      );
      expect(res.body.data.curriculums[0].regulationId._id).toBe(
        String(regA._id)
      );
      expect(res.body.data.curriculums[0].isActive).toBe(true);
    });

    test('should ignore invalid departmentId/regulationId query filters', async () => {
      const token = await createAdminToken();
      const dep = await createDepartment({ code: 'IGN' });
      const reg = await createRegulation({ name: 'R2038', startYear: 2038 });

      await Curriculum.create({
        departmentId: dep._id,
        regulationId: reg._id,
        semesters: []
      });

      const res = await request(app)
        .get('/api/curriculums?departmentId=bad&regulationId=bad')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.curriculums).toHaveLength(1);
    });
  });

  describe('GET /api/curriculums/:id', () => {
    test('should fail with invalid curriculum id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/curriculums/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid curriculum id');
    });

    test('should return 404 for missing curriculum', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .get('/api/curriculums/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Curriculum not found');
    });

    test('should return curriculum by id with populated refs', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'ID1' });
      const regulation = await createRegulation({
        name: 'R2039',
        startYear: 2039
      });
      const subject = await createSubject(department._id, { code: 'ID101' });

      const curriculum = await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: [{ semesterNumber: 1, subjects: [subject._id] }]
      });

      const res = await request(app)
        .get(`/api/curriculums/${curriculum._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Curriculum retrieved successfully');
      expect(res.body.data.curriculum._id).toBe(String(curriculum._id));
      expect(res.body.data.curriculum.departmentId._id).toBe(
        String(department._id)
      );
      expect(res.body.data.curriculum.regulationId._id).toBe(
        String(regulation._id)
      );
      expect(res.body.data.curriculum.semesters[0].subjects[0]._id).toBe(
        String(subject._id)
      );
    });
  });

  describe('PUT /api/curriculums/:id', () => {
    test('should fail without token', async () => {
      const department = await createDepartment({ code: 'UP1' });
      const regulation = await createRegulation({
        name: 'R2040',
        startYear: 2040
      });
      const curriculum = await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: []
      });

      const res = await request(app)
        .put(`/api/curriculums/${curriculum._id}`)
        .send({ isActive: false });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    test('should fail for non-admin user', async () => {
      const token = await createFacultyToken();
      const department = await createDepartment({ code: 'UP2' });
      const regulation = await createRegulation({
        name: 'R2041',
        startYear: 2041
      });
      const curriculum = await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: []
      });

      const res = await request(app)
        .put(`/api/curriculums/${curriculum._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Access denied');
    });

    test('should fail with invalid curriculum id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/curriculums/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid curriculum id');
    });

    test('should return 404 when curriculum does not exist', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .put('/api/curriculums/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Curriculum not found');
    });

    test('should fail when update departmentId is invalid', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'UP3' });
      const regulation = await createRegulation({
        name: 'R2042',
        startYear: 2042
      });
      const curriculum = await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: []
      });

      const res = await request(app)
        .put(`/api/curriculums/${curriculum._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId: 'bad-id' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid departmentId');
    });

    test('should fail when update regulationId is invalid', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'UP4' });
      const regulation = await createRegulation({
        name: 'R2043',
        startYear: 2043
      });
      const curriculum = await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: []
      });

      const res = await request(app)
        .put(`/api/curriculums/${curriculum._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ regulationId: 'bad-id' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid regulationId');
    });

    test('should fail when update department does not exist', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'UP5' });
      const regulation = await createRegulation({
        name: 'R2044',
        startYear: 2044
      });
      const curriculum = await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: []
      });

      const res = await request(app)
        .put(`/api/curriculums/${curriculum._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId: '507f1f77bcf86cd799439011' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Department not found');
    });

    test('should fail when update regulation does not exist', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'UP6' });
      const regulation = await createRegulation({
        name: 'R2045',
        startYear: 2045
      });
      const curriculum = await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: []
      });

      const res = await request(app)
        .put(`/api/curriculums/${curriculum._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ regulationId: '507f1f77bcf86cd799439011' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Regulation not found');
    });

    test('should fail when update semesters contains duplicate semester number', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'UP7' });
      const regulation = await createRegulation({
        name: 'R2046',
        startYear: 2046
      });
      const curriculum = await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: []
      });

      const res = await request(app)
        .put(`/api/curriculums/${curriculum._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          semesters: [
            { semesterNumber: 1, subjects: [] },
            { semesterNumber: 1, subjects: [] }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Duplicate semesterNumber');
    });

    test('should update curriculum successfully', async () => {
      const token = await createAdminToken();
      const dep1 = await createDepartment({ code: 'UP8' });
      const dep2 = await createDepartment({ code: 'UP9' });
      const reg1 = await createRegulation({ name: 'R2047', startYear: 2047 });
      const reg2 = await createRegulation({ name: 'R2048', startYear: 2048 });
      const subject = await createSubject(dep2._id, { code: 'UP201' });

      const curriculum = await Curriculum.create({
        departmentId: dep1._id,
        regulationId: reg1._id,
        semesters: []
      });

      const res = await request(app)
        .put(`/api/curriculums/${curriculum._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          departmentId: String(dep2._id),
          regulationId: String(reg2._id),
          semesters: [{ semesterNumber: 1, subjects: [String(subject._id)] }],
          isActive: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Curriculum updated successfully');
      expect(res.body.data.curriculum.departmentId._id).toBe(String(dep2._id));
      expect(res.body.data.curriculum.regulationId._id).toBe(String(reg2._id));
      expect(res.body.data.curriculum.semesters).toHaveLength(1);
      expect(res.body.data.curriculum.semesters[0].subjects[0]._id).toBe(
        String(subject._id)
      );
      expect(res.body.data.curriculum.isActive).toBe(false);
    });
  });

  describe('DELETE /api/curriculums/:id', () => {
    test('should fail with invalid curriculum id', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/curriculums/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid curriculum id');
    });

    test('should return 404 for missing curriculum', async () => {
      const token = await createAdminToken();

      const res = await request(app)
        .delete('/api/curriculums/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Curriculum not found');
    });

    test('should delete curriculum successfully', async () => {
      const token = await createAdminToken();
      const department = await createDepartment({ code: 'DEL1' });
      const regulation = await createRegulation({
        name: 'R2049',
        startYear: 2049
      });
      const curriculum = await Curriculum.create({
        departmentId: department._id,
        regulationId: regulation._id,
        semesters: []
      });

      const res = await request(app)
        .delete(`/api/curriculums/${curriculum._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Curriculum deleted successfully');

      const deleted = await Curriculum.findById(curriculum._id);
      expect(deleted).toBeNull();
    });
  });
});
