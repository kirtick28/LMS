import mongoose from 'mongoose';
import Classroom from '../models/Classroom.js';
import ClassroomMember from '../models/ClassroomMember.js';
import AcademicYear from '../models/AcademicYear.js';
import Section from '../models/Section.js';
import SubjectComponent from '../models/SubjectComponent.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const getClassrooms = catchAsync(async (req, res, next) => {
  let { facultyId, sectionId, academicYearId, semesterNumber, status } =
    req.query;

  if (!academicYearId) {
    const activeYear = await AcademicYear.findOne({ isActive: true });

    if (!activeYear) {
      return next(new AppError('Active academic year not found', 404));
    }

    academicYearId = activeYear._id;
  }

  const filter = {
    academicYearId
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

  if (facultyId) {
    if (!isValidObjectId(facultyId)) {
      return next(new AppError('Invalid facultyId', 400));
    }

    const memberships = await ClassroomMember.find({
      userId: facultyId,
      role: 'faculty',
      status: 'active'
    }).select('classroomId');

    const classroomIds = memberships.map((m) => m.classroomId);

    filter._id = { $in: classroomIds };
  }

  const classrooms = await Classroom.find(filter)
    .populate('sectionId', 'name')
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

  res.status(200).json({
    success: true,
    message: 'Classrooms fetched successfully',
    data: { classrooms }
  });
});

export const getClassroomById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return next(new AppError('Invalid classroom id', 400));
  }

  const classroom = await Classroom.findById(id)
    .populate('sectionId', 'name')
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

  res.status(200).json({
    success: true,
    data: { classroom }
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
    .populate('sectionId', 'name')
    .populate({
      path: 'subjectComponentId',
      populate: {
        path: 'subjectId',
        select: 'name code shortName'
      }
    })
    .populate('academicYearId', 'name');

  if (!classroom) {
    return next(new AppError('Classroom not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Classroom updated successfully',
    data: { classroom }
  });
});
