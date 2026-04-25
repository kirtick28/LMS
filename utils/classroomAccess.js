import mongoose from 'mongoose';

import AcademicYear from '../models/AcademicYear.js';
import Classroom from '../models/Classroom.js';
import ClassroomMember from '../models/ClassroomMember.js';
import Student from '../models/Student.js';
import StudentAcademicRecord from '../models/StudentAcademicRecord.js';
import AppError from './AppError.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const resolveAcademicYear = async (academicYearId = null) => {
  if (academicYearId) {
    if (!isValidObjectId(academicYearId)) {
      throw new AppError('Invalid academicYearId', 400);
    }

    const academicYear = await AcademicYear.findById(academicYearId).lean();
    if (!academicYear) {
      throw new AppError('Academic year not found', 404);
    }
    return academicYear;
  }

  const activeAcademicYear = await AcademicYear.findOne({ isActive: true }).lean();
  if (!activeAcademicYear) {
    throw new AppError('Active academic year not found', 404);
  }

  return activeAcademicYear;
};

export const getStudentAcademicContext = async (userId, academicYearId) => {
  const student = await Student.findOne({
    userId,
    status: 'active'
  })
    .select(
      '_id userId sectionId semesterNumber departmentId batchId firstName lastName registerNumber rollNumber'
    )
    .lean();

  if (!student) {
    throw new AppError('Student profile not found', 404);
  }

  let academicRecord = null;
  if (academicYearId) {
    academicRecord = await StudentAcademicRecord.findOne({
      studentId: student._id,
      academicYearId,
      status: 'active'
    })
      .select('semesterNumber sectionId academicYearId')
      .lean();
  }

  return { student, academicRecord };
};

export const getClassroomStudentCount = async (classroom) => {
  return StudentAcademicRecord.countDocuments({
    academicYearId: classroom.academicYearId,
    semesterNumber: classroom.semesterNumber,
    sectionId: classroom.sectionId,
    status: 'active'
  });
};

export const getClassroomStudentRoster = async (classroom) => {
  const records = await StudentAcademicRecord.find({
    academicYearId: classroom.academicYearId,
    semesterNumber: classroom.semesterNumber,
    sectionId: classroom.sectionId,
    status: 'active'
  })
    .select('studentId')
    .lean();

  const studentIds = records.map((record) => record.studentId);
  if (!studentIds.length) {
    return [];
  }

  return Student.find({
    _id: { $in: studentIds },
    status: 'active'
  })
    .select(
      '_id userId firstName lastName registerNumber rollNumber sectionId semesterNumber'
    )
    .sort({ firstName: 1, lastName: 1 })
    .lean();
};

export const ensureClassroomAccess = async ({
  classroomId,
  user,
  requireFaculty = false
}) => {
  if (!isValidObjectId(classroomId)) {
    throw new AppError('Invalid classroomId', 400);
  }

  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom || classroom.isDeleted) {
    throw new AppError('Classroom not found', 404);
  }

  if (user.role === 'ADMIN' || user.role === 'HOD') {
    return classroom;
  }

  if (user.role === 'FACULTY') {
    const membership = await ClassroomMember.findOne({
      classroomId,
      userId: user._id,
      role: 'FACULTY',
      status: 'active'
    })
      .select('_id')
      .lean();

    if (!membership) {
      throw new AppError('You are not allowed to access this classroom', 403);
    }

    return classroom;
  }

  if (user.role === 'STUDENT') {
    if (requireFaculty) {
      throw new AppError('You are not allowed to perform this action', 403);
    }

    const { student, academicRecord } = await getStudentAcademicContext(
      user._id,
      classroom.academicYearId
    );

    const currentSectionId = academicRecord?.sectionId || student.sectionId;
    const currentSemesterNumber =
      academicRecord?.semesterNumber || student.semesterNumber;

    const hasAccess =
      currentSectionId &&
      String(currentSectionId) === String(classroom.sectionId) &&
      Number(currentSemesterNumber) === Number(classroom.semesterNumber);

    if (!hasAccess) {
      throw new AppError('You are not allowed to access this classroom', 403);
    }

    return classroom;
  }

  throw new AppError('You are not allowed to access this classroom', 403);
};
