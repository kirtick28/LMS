import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../app.js';
import AcademicYear from '../models/AcademicYear.js';
import Assignment from '../models/Assignment.js';
import Attendance from '../models/Attendance.js';
import Batch from '../models/Batch.js';
import BatchProgram from '../models/BatchProgram.js';
import Classroom from '../models/Classroom.js';
import ClassroomPost from '../models/ClassroomPost.js';
import CoursePlan from '../models/CoursePlan.js';
import Department from '../models/Department.js';
import Faculty from '../models/Faculty.js';
import FacultyAssignment from '../models/FacultyAssignment.js';
import Regulation from '../models/Regulation.js';
import Section from '../models/Section.js';
import Student from '../models/Student.js';
import Subject from '../models/Subject.js';
import Submission from '../models/Submission.js';
import Timetable from '../models/Timetable.js';
import User from '../models/User.js';

describe('Dashboard API', () => {
  let seq = 0;
  const uniq = () => `${Date.now()}-${++seq}`;

  const createToken = (user) =>
    jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

  const createUser = async (overrides = {}) =>
    await User.create({
      email: overrides.email || `user-${uniq()}@example.com`,
      password: overrides.password || 'password123',
      role: overrides.role || 'ADMIN',
      isActive:
        typeof overrides.isActive === 'boolean' ? overrides.isActive : true,
      gender: overrides.gender || 'Male'
    });

  const createDepartment = async (overrides = {}) =>
    await Department.create({
      name: overrides.name || `Department-${uniq()}`,
      code: overrides.code || `D${uniq().slice(-5)}`,
      program: overrides.program || 'B.E.'
    });

  const createAcademicYear = async (overrides = {}) =>
    await AcademicYear.create({
      name: overrides.name || `2025-${String(26 + seq).slice(-2)}`,
      startYear: overrides.startYear || 2025,
      endYear: overrides.endYear || 2026,
      isActive:
        typeof overrides.isActive === 'boolean' ? overrides.isActive : true
    });

  const createRegulation = async (overrides = {}) =>
    await Regulation.create({
      name: overrides.name || `R${2021 + seq}`,
      startYear: overrides.startYear || 2021,
      totalSemesters: overrides.totalSemesters || 8,
      isActive:
        typeof overrides.isActive === 'boolean' ? overrides.isActive : true
    });

  const createFacultyRecord = async (overrides = {}) => {
    const department = overrides.department || (await createDepartment());
    const user =
      overrides.user ||
      (await createUser({
        role: 'FACULTY',
        email: `faculty-${uniq()}@example.com`
      }));

    const faculty = await Faculty.create({
      userId: user._id,
      departmentId: department._id,
      salutation: 'Dr.',
      firstName: overrides.firstName || 'Faculty',
      lastName: overrides.lastName || uniq(),
      primaryPhone: overrides.primaryPhone || '9876543210',
      employeeId: overrides.employeeId || `EMP${uniq().slice(-5)}`,
      designation: overrides.designation || 'Assistant Professor',
      qualification: 'M.E',
      workType: 'Full Time',
      joiningDate: new Date('2022-06-10'),
      employmentStatus: overrides.employmentStatus || 'ACTIVE'
    });

    return { user, faculty, department };
  };

  const createStudentRecord = async (overrides = {}) => {
    const department = overrides.department || (await createDepartment());
    const batch =
      overrides.batch ||
      (await Batch.create({
        startYear: overrides.batchStartYear || 2022,
        endYear: overrides.batchEndYear || 2026,
        name: overrides.batchName || `2022-2026-${uniq()}`
      }));
    const regulation = overrides.regulation || (await createRegulation());
    const batchProgram =
      overrides.batchProgram ||
      (await BatchProgram.create({
        batchId: batch._id,
        departmentId: department._id,
        regulationId: regulation._id
      }));
    const section =
      overrides.section ||
      (await Section.create({
        name: overrides.sectionName || `S${seq}`,
        batchProgramId: batchProgram._id,
        capacity: 60,
        isActive:
          typeof overrides.sectionIsActive === 'boolean'
            ? overrides.sectionIsActive
            : true
      }));
    const user =
      overrides.user ||
      (await createUser({
        role: 'STUDENT',
        email: `student-${uniq()}@example.com`
      }));

    const student = await Student.create({
      userId: user._id,
      departmentId: department._id,
      batchId: batch._id,
      sectionId: section._id,
      firstName: overrides.firstName || 'Student',
      lastName: overrides.lastName || uniq(),
      registerNumber: overrides.registerNumber || `REG${uniq().slice(-6)}`,
      semesterNumber: overrides.semesterNumber || 1,
      status: overrides.status || 'active'
    });

    return { user, student, department, batch, batchProgram, section, regulation };
  };

  test('GET /api/dashboard/admin should return institution-wide statistics', async () => {
    const admin = await createUser({
      role: 'ADMIN',
      email: `admin-${uniq()}@example.com`
    });
    const academicYear = await createAcademicYear({ name: '2025-26' });
    const cse = await createDepartment({ name: 'CSE', code: 'CSE' });
    const ece = await createDepartment({ name: 'ECE', code: 'ECE' });

    const cseHod = await createFacultyRecord({
      department: cse,
      employeeId: 'EMP1001',
      designation: 'HOD'
    });
    await createFacultyRecord({
      department: cse,
      employeeId: 'EMP1002',
      designation: 'Professor'
    });
    await createFacultyRecord({
      department: ece,
      employeeId: 'EMP1003',
      designation: 'Assistant Professor'
    });

    const studentOne = await createStudentRecord({
      department: cse,
      registerNumber: 'REG1001',
      semesterNumber: 1
    });
    const studentTwo = await createStudentRecord({
      department: cse,
      registerNumber: 'REG1002',
      semesterNumber: 3
    });
    await createStudentRecord({
      department: ece,
      registerNumber: 'REG1003',
      semesterNumber: 7,
      status: 'graduated'
    });

    const subject = await Subject.create({
      name: 'Data Structures',
      shortName: 'DS',
      code: 'CS2301',
      departmentId: cse._id,
      regulationId: studentOne.regulation._id,
      courseCategory: 'Professional Core',
      deliveryType: 'T',
      credits: 4
    });

    const classroom = await Classroom.create({
      sectionId: studentOne.section._id,
      subjectId: subject._id,
      academicYearId: academicYear._id,
      semesterNumber: 1,
      name: 'CSE A DS',
      status: 'active',
      createdBy: cseHod.user._id
    });

    await Timetable.create({
      sectionId: studentOne.section._id,
      academicYearId: academicYear._id,
      semesterNumber: 1,
      slots: [{ order: 1, startTime: '09:00', endTime: '09:50', type: 'class' }]
    });

    const teachingFaculty = await Faculty.findOne({ employeeId: 'EMP1002' });

    await FacultyAssignment.create({
      facultyIds: [teachingFaculty._id],
      sectionId: studentOne.section._id,
      subjectComponentId: subject._id,
      academicYearId: academicYear._id,
      semesterNumber: 1
    });

    await CoursePlan.create({
      subjectId: subject._id,
      sectionId: studentOne.section._id,
      academicYearId: academicYear._id,
      status: 'Submitted'
    });

    const post = await ClassroomPost.create({
      classroomId: classroom._id,
      createdBy: teachingFaculty.userId,
      createdByRole: 'FACULTY',
      type: 'assignment',
      title: 'Assignment 1'
    });

    const assignment = await Assignment.create({
      postId: post._id,
      dueDate: new Date('2026-04-20T00:00:00.000Z')
    });

    await Submission.create({
      assignmentId: assignment._id,
      studentId: studentTwo.user._id,
      status: 'submitted',
      submittedAt: new Date('2026-04-15T00:00:00.000Z')
    });

    await Attendance.create({
      classroom: classroom._id,
      timetableEntry: subject._id,
      faculty: teachingFaculty._id,
      date: new Date('2026-04-15T00:00:00.000Z'),
      dateString: '2026-04-15',
      status: 'MARKED',
      records: [
        { student: studentOne.student._id, status: 'Present' },
        { student: studentTwo.student._id, status: 'Absent' }
      ]
    });

    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', `Bearer ${createToken(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scope).toBe('ADMIN');
    expect(res.body.data.academicYear.name).toBe('2025-26');
    expect(res.body.data.overview.totalDepartments).toBe(2);
    expect(res.body.data.overview.totalFaculty).toBe(3);
    expect(res.body.data.overview.totalStudents).toBe(3);
    expect(res.body.data.overview.totalClassrooms).toBe(1);
    expect(res.body.data.breakdowns.studentsByDepartment).toHaveLength(2);
    expect(res.body.data.breakdowns.coursePlansByStatus.counts.Submitted).toBe(1);
    expect(res.body.data.breakdowns.classroomPostsByType.counts.assignment).toBe(1);
    expect(res.body.data.breakdowns.attendanceByStatus.counts.MARKED).toBe(1);
    expect(res.body.data.breakdowns.submissionsByStatus.counts.submitted).toBe(1);
  });

  test('GET /api/dashboard/hod should return department-scoped statistics', async () => {
    const academicYear = await createAcademicYear({ name: '2025-26' });
    const cse = await createDepartment({ name: 'Computer Science', code: 'CSC' });
    const ece = await createDepartment({ name: 'Electronics', code: 'ELC' });

    const hodUser = await createUser({
      role: 'FACULTY',
      email: `hod-${uniq()}@example.com`
    });

    await createFacultyRecord({
      user: hodUser,
      department: cse,
      employeeId: 'EMP2001',
      designation: 'HOD'
    });

    const faculty = await createFacultyRecord({
      department: cse,
      employeeId: 'EMP2002',
      designation: 'Assistant Professor'
    });

    await createFacultyRecord({
      department: ece,
      employeeId: 'EMP2003',
      designation: 'Professor'
    });

    const cseStudentOne = await createStudentRecord({
      department: cse,
      registerNumber: 'REG2001',
      semesterNumber: 1
    });
    const cseStudentTwo = await createStudentRecord({
      department: cse,
      registerNumber: 'REG2002',
      semesterNumber: 5,
      batchStartYear: 2021,
      batchEndYear: 2025,
      batchName: '2021-2025'
    });
    await createStudentRecord({
      department: ece,
      registerNumber: 'REG2003',
      semesterNumber: 3
    });

    const subject = await Subject.create({
      name: 'Operating Systems',
      shortName: 'OS',
      code: 'CS2401',
      departmentId: cse._id,
      regulationId: cseStudentOne.regulation._id,
      courseCategory: 'Professional Core',
      deliveryType: 'T',
      credits: 4
    });

    const classroom = await Classroom.create({
      sectionId: cseStudentOne.section._id,
      subjectId: subject._id,
      academicYearId: academicYear._id,
      semesterNumber: 1,
      name: 'CSE OS',
      status: 'active',
      createdBy: faculty.user._id
    });

    await Timetable.create({
      sectionId: cseStudentOne.section._id,
      academicYearId: academicYear._id,
      semesterNumber: 1,
      slots: [{ order: 1, startTime: '10:00', endTime: '10:50', type: 'class' }]
    });

    await FacultyAssignment.create({
      facultyIds: [faculty.faculty._id],
      sectionId: cseStudentOne.section._id,
      subjectComponentId: subject._id,
      academicYearId: academicYear._id,
      semesterNumber: 1,
      status: 'active'
    });

    await CoursePlan.create({
      subjectId: subject._id,
      sectionId: cseStudentOne.section._id,
      academicYearId: academicYear._id,
      status: 'Approved'
    });

    await ClassroomPost.create({
      classroomId: classroom._id,
      createdBy: faculty.user._id,
      createdByRole: 'FACULTY',
      type: 'material',
      title: 'Unit 1 Notes'
    });

    const assignmentPost = await ClassroomPost.create({
      classroomId: classroom._id,
      createdBy: faculty.user._id,
      createdByRole: 'FACULTY',
      type: 'assignment',
      title: 'OS Assignment'
    });

    const assignment = await Assignment.create({
      postId: assignmentPost._id,
      dueDate: new Date('2026-04-21T00:00:00.000Z')
    });

    await Submission.create({
      assignmentId: assignment._id,
      studentId: cseStudentOne.user._id,
      status: 'graded',
      submittedAt: new Date('2026-04-15T00:00:00.000Z')
    });

    await Attendance.create({
      classroom: classroom._id,
      timetableEntry: subject._id,
      faculty: faculty.faculty._id,
      date: new Date('2026-04-15T00:00:00.000Z'),
      dateString: '2026-04-15',
      status: 'UPDATED_BY_HOD',
      records: [{ student: cseStudentOne.student._id, status: 'Present' }]
    });

    const res = await request(app)
      .get('/api/dashboard/hod')
      .set('Authorization', `Bearer ${createToken(hodUser)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scope).toBe('HOD');
    expect(res.body.data.department.code).toBe('CSC');
    expect(res.body.data.overview.totalFaculty).toBe(2);
    expect(res.body.data.overview.totalStudents).toBe(2);
    expect(res.body.data.overview.totalSubjects).toBe(1);
    expect(res.body.data.breakdowns.coursePlansByStatus.counts.Approved).toBe(1);
    expect(res.body.data.breakdowns.attendanceByStatus.counts.UPDATED_BY_HOD).toBe(1);
    expect(res.body.data.breakdowns.classroomPostsByType.counts.material).toBe(1);
    expect(res.body.data.breakdowns.classroomPostsByType.counts.assignment).toBe(1);
    expect(res.body.data.breakdowns.submissionsByStatus.counts.graded).toBe(1);
    expect(res.body.data.breakdowns.studentsByBatch).toHaveLength(2);
  });

  test('GET /api/dashboard/hod should reject admin users', async () => {
    const admin = await createUser({
      role: 'ADMIN',
      email: `admin-${uniq()}@example.com`
    });

    const res = await request(app)
      .get('/api/dashboard/hod')
      .set('Authorization', `Bearer ${createToken(admin)}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Access denied');
  });
});
