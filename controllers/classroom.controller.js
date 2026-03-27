import mongoose from 'mongoose';
import Classroom from '../models/Classroom.js';
import ClassroomMember from '../models/ClassroomMember.js';
import AcademicYear from '../models/AcademicYear.js';
import Section from '../models/Section.js';
import SubjectComponent from '../models/SubjectComponent.js';
import Faculty from '../models/Faculty.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

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

export const getClassrooms = catchAsync(async (req, res, next) => {
  let {
    facultyId: userId,
    sectionId,
    academicYearId,
    semesterNumber,
    status
  } = req.query;

  if (!academicYearId) {
    const activeYear = await AcademicYear.findOne({ isActive: true });

    if (!activeYear) {
      return next(new AppError('Active academic year not found', 404));
    }

    academicYearId = activeYear._id;
  }

  const filter = { academicYearId };

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

  if (userId) {
    if (!isValidObjectId(userId)) {
      return next(new AppError('Invalid facultyId', 400));
    }
    const faculty = await Faculty.findOne({ userId });
    const facultyId = faculty._id;

    const memberships = await ClassroomMember.find({
      userId: facultyId,
      role: 'faculty',
      status: 'active'
    }).select('classroomId');

    const classroomIds = memberships.map((m) => m.classroomId);

    filter._id = { $in: classroomIds };
  }

  const classrooms = await Classroom.find(filter)
    .populate(sectionDepartmentPopulate)
    .populate({
      path: 'subjectComponentId',
      populate: {
        path: 'subjectId',
        select: 'name code shortName'
      }
    })
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

  if (!isValidObjectId(id)) {
    return next(new AppError('Invalid classroom id', 400));
  }

  const classroom = await Classroom.findById(id)
    .populate(sectionDepartmentPopulate)
    .populate({
      path: 'subjectComponentId',
      populate: {
        path: 'subjectId',
        select: 'name code shortName'
      }
    })
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

  if (!isValidObjectId(id)) {
    return next(new AppError('Invalid classroom id', 400));
  }

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
    .populate({
      path: 'subjectComponentId',
      populate: {
        path: 'subjectId',
        select: 'name code shortName'
      }
    })
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
