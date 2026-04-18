import mongoose from 'mongoose';
import Classroom from '../models/Classroom.js';
import ClassroomMember from '../models/ClassroomMember.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import {
  ensureClassroomAccess,
  getStudentAcademicContext,
  resolveAcademicYear
} from '../utils/classroomAccess.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const sectionDepartmentPopulate = {
  path: 'sectionId',
  select: 'name batchProgramId',
  populate: {
    path: 'batchProgramId',
    select: 'departmentId',
    populate: {
      path: 'departmentId',
      select: 'name code'
    }
  }
};

const subjectPopulate = {
  path: 'subjectId',
  select: 'name code shortName deliveryType credits'
};

export const getClassrooms = catchAsync(async (req, res, next) => {
  let { userId, sectionId, academicYearId, semesterNumber, status } = req.query;
  const academicYear = await resolveAcademicYear(academicYearId);
  academicYearId = academicYear._id;

  const filter = {
    academicYearId,
    isDeleted: false
  };

  if (sectionId) {
    if (!isValidObjectId(sectionId))
      return next(new AppError('Invalid sectionId', 400));
    filter.sectionId = sectionId;
  }

  if (semesterNumber) {
    filter.semesterNumber = Number(semesterNumber);
  }

  if (status) {
    filter.status = status;
  }

  if (req.user.role === 'STUDENT') {
    const { student, academicRecord } = await getStudentAcademicContext(
      req.user._id,
      academicYearId
    );

    filter.sectionId = academicRecord?.sectionId || student.sectionId;
    filter.semesterNumber =
      academicRecord?.semesterNumber || student.semesterNumber;
    filter.status = status || 'active';
  } else {
    const requestedUserId = userId || req.user._id;

    if (userId && req.user.role !== 'ADMIN' && String(userId) !== String(req.user._id)) {
      return next(new AppError('You are not allowed to view another user', 403));
    }

    if (requestedUserId && req.user.role !== 'ADMIN') {
      if (!isValidObjectId(requestedUserId)) {
        return next(new AppError('Invalid userId', 400));
      }

      const memberships = await ClassroomMember.find({
        userId: requestedUserId,
        role: 'FACULTY',
        status: 'active'
      }).select('classroomId');

      const classroomIds = memberships.map((membership) => membership.classroomId);
      if (!classroomIds.length) {
        return res.status(200).json({
          success: true,
          message: 'No classrooms found for this user',
          data: { classrooms: [] }
        });
      }

      filter._id = { $in: classroomIds };
    } else if (requestedUserId && req.user.role === 'ADMIN' && userId) {
      if (!isValidObjectId(requestedUserId)) {
        return next(new AppError('Invalid userId', 400));
      }

      const memberships = await ClassroomMember.find({
        userId: requestedUserId,
        status: 'active'
      }).select('classroomId');

      if (!memberships.length) {
        return res.status(200).json({
          success: true,
          message: 'No classrooms found for this user',
          data: { classrooms: [] }
        });
      }

      filter._id = { $in: memberships.map((membership) => membership.classroomId) };
    }
  }

  const classrooms = await Classroom.find(filter)
    .populate(sectionDepartmentPopulate)
    .populate(subjectPopulate)
    .populate('academicYearId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const transformed = classrooms.map((c) => {
    const dept = c.sectionId?.batchProgramId?.departmentId || null;
    return {
      ...c,
      sectionId: c.sectionId
        ? {
            _id: c.sectionId._id,
            name: c.sectionId.name
          }
        : null,
      department: dept
        ? {
            name: dept.name,
            code: dept.code
          }
        : null
    };
  });

  res.status(200).json({
    success: true,
    message: 'Classrooms fetched successfully',
    data: { classrooms: transformed }
  });
});

export const getClassroomById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await ensureClassroomAccess({ classroomId: id, user: req.user });

  const classroom = await Classroom.findById(id)
    .populate(sectionDepartmentPopulate)
    .populate(subjectPopulate)
    .populate('academicYearId', 'name')
    .lean();

  if (!classroom) {
    return next(new AppError('Classroom not found', 404));
  }

  const dept = classroom.sectionId?.batchProgramId?.departmentId || null;

  const transformed = {
    ...classroom,
    sectionId: classroom.sectionId
      ? {
          _id: classroom.sectionId._id,
          name: classroom.sectionId.name
        }
      : null,
    department: dept
      ? {
          name: dept.name,
          code: dept.code
        }
      : null
  };

  res.status(200).json({
    success: true,
    data: { classroom: transformed }
  });
});

export const updateClassroom = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  await ensureClassroomAccess({
    classroomId: id,
    user: req.user,
    requireFaculty: true
  });

  const allowedFields = ['name', 'status'];

  const updateData = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      updateData[key] = req.body[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return next(new AppError('No valid fields to update', 400));
  }

  const classroom = await Classroom.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true
  })
    .populate(sectionDepartmentPopulate)
    .populate(subjectPopulate)
    .populate('academicYearId', 'name')
    .lean();

  if (!classroom) {
    return next(new AppError('Classroom not found', 404));
  }

  const dept = classroom.sectionId?.batchProgramId?.departmentId || null;

  const transformed = {
    ...classroom,
    sectionId: classroom.sectionId
      ? {
          _id: classroom.sectionId._id,
          name: classroom.sectionId.name
        }
      : null,
    department: dept
      ? {
          name: dept.name,
          code: dept.code
        }
      : null
  };

  res.status(200).json({
    success: true,
    message: 'Classroom updated successfully',
    data: { classroom: transformed }
  });
});
