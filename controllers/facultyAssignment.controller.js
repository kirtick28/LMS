import mongoose from 'mongoose';
import FacultyAssignment from '../models/FacultyAssignment.js';
import Faculty from '../models/Faculty.js';
import Section from '../models/Section.js';
import Subject from '../models/Subject.js';
import Batch from '../models/Batch.js';
import BatchProgram from '../models/BatchProgram.js';
import AcademicYear from '../models/AcademicYear.js';
import StudentAcademicRecord from '../models/StudentAcademicRecord.js';
import Curriculum from '../models/Curriculum.js';
import catchAsync from '../utils/catchAsync.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createFacultyAssignment = catchAsync(async (req, res, next) => {
  const {
    facultyId,
    sectionId,
    subjectComponentId,
    academicYearId,
    semesterNumber
  } = req.body;

  if (
    !facultyId ||
    !sectionId ||
    !subjectComponentId ||
    !academicYearId ||
    !semesterNumber
  ) {
    return next(
      new AppError(
        'facultyId, sectionId, subjectComponentId, academicYearId, and semesterNumber are required',
        400
      )
    );
  }

  if (
    !isValidObjectId(facultyId) ||
    !isValidObjectId(sectionId) ||
    !isValidObjectId(subjectComponentId) ||
    !isValidObjectId(academicYearId)
  ) {
    return next(new AppError('Invalid ObjectId provided', 400));
  }

  const [faculty, section, component, academicYear] = await Promise.all([
    Faculty.findById(facultyId),
    Section.findById(sectionId).populate('batchProgramId'),
    SubjectComponent.findById(subjectComponentId).populate('subjectId'),
    AcademicYear.findById(academicYearId)
  ]);

  if (!faculty || !section || !component || !academicYear) {
    return next(
      new AppError(
        'Referenced Faculty, Section, SubjectComponent, or AcademicYear not found',
        404
      )
    );
  }

  const subject = component.subjectId;

  const batchProgram = section.batchProgramId;

  if (!batchProgram) {
    return next(
      new AppError('Section is not properly mapped to a BatchProgram', 400)
    );
  }

  const curriculum = await Curriculum.findOne({
    departmentId: batchProgram.departmentId,
    regulationId: batchProgram.regulationId,
    'semesters.semesterNumber': semesterNumber,
    'semesters.subjects': subject._id
  });

  if (!curriculum) {
    return next(
      new AppError(
        'This subject is not part of the curriculum for this department, regulation, and semester',
        400
      )
    );
  }

  const existing = await FacultyAssignment.findOne({
    sectionId,
    subjectComponentId,
    academicYearId,
    semesterNumber,
    status: 'active'
  });

  if (existing) {
    return next(
      new AppError(
        'A faculty member is already assigned to this subject component for this section in this academic year',
        409
      )
    );
  }

  const assignment = await FacultyAssignment.create({
    facultyId,
    sectionId,
    subjectComponentId,
    academicYearId,
    semesterNumber,
    assignedBy: req.user?._id || null,
    status: 'active'
  });

  res.status(201).json({
    success: true,
    message: 'Faculty Assignment created successfully',
    data: { assignment }
  });
});

export const getAllFacultyAssignments = catchAsync(async (req, res, next) => {
  const { facultyId, sectionId, academicYearId, status } = req.query;

  const filter = {};

  if (facultyId) {
    if (!isValidObjectId(facultyId))
      return next(new AppError('Invalid facultyId', 400));
    filter.facultyId = facultyId;
  }

  if (sectionId) {
    if (!isValidObjectId(sectionId))
      return next(new AppError('Invalid sectionId', 400));
    filter.sectionId = sectionId;
  }

  if (academicYearId) {
    if (!isValidObjectId(academicYearId))
      return next(new AppError('Invalid academicYearId', 400));
    filter.academicYearId = academicYearId;
  }

  if (status) {
    filter.status = status;
  }

  const assignments = await FacultyAssignment.find(filter)
    .populate('facultyId', 'firstName lastName employeeId')
    .populate('sectionId', 'name')
    .populate({
      path: 'subjectComponentId',
      populate: {
        path: 'subjectId',
        select: 'name code shortName deliveryType'
      }
    })
    .populate('academicYearId', 'name')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    message: 'Faculty Assignments retrieved successfully',
    data: { assignments }
  });
});

export const getFacultyAssignmentById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return next(new AppError('Invalid assignment id', 400));
  }

  const assignment = await FacultyAssignment.findById(id)
    .populate('facultyId', 'firstName lastName employeeId')
    .populate('sectionId', 'name')
    .populate({
      path: 'subjectComponentId',
      populate: {
        path: 'subjectId',
        select: 'name code shortName deliveryType'
      }
    })
    .populate('academicYearId', 'name');

  if (!assignment) {
    return next(new AppError('Faculty Assignment not found', 404));
  }

  res.json({
    success: true,
    message: 'Faculty Assignment retrieved successfully',
    data: { assignment }
  });
});

export const updateFacultyAssignment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updates = { ...req.body };

  if (!isValidObjectId(id)) {
    return next(new AppError('Invalid assignment id', 400));
  }

  const current = await FacultyAssignment.findById(id);

  if (!current) {
    return next(new AppError('Faculty Assignment not found', 404));
  }

  const objectIdFields = [
    'facultyId',
    'sectionId',
    'subjectComponentId',
    'academicYearId'
  ];

  for (const field of objectIdFields) {
    if (updates[field] && !isValidObjectId(updates[field])) {
      return next(new AppError(`Invalid ${field}`, 400));
    }
  }

  if (
    updates.sectionId ||
    updates.subjectComponentId ||
    updates.academicYearId ||
    updates.semesterNumber
  ) {
    const targetSectionId = updates.sectionId || current.sectionId;
    const targetSubjectComponentId =
      updates.subjectComponentId || current.subjectComponentId;
    const targetAcademicYearId =
      updates.academicYearId || current.academicYearId;
    const targetSemesterNumber =
      updates.semesterNumber || current.semesterNumber;

    const duplicate = await FacultyAssignment.findOne({
      _id: { $ne: id },
      sectionId: targetSectionId,
      subjectComponentId: targetSubjectComponentId,
      academicYearId: targetAcademicYearId,
      semesterNumber: targetSemesterNumber,
      status: 'active'
    });

    if (duplicate) {
      return next(
        new AppError(
          'A faculty member is already assigned to this subject component for this section in this academic year',
          409
        )
      );
    }
  }

  const assignment = await FacultyAssignment.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true
  })
    .populate('facultyId', 'firstName lastName employeeId')
    .populate('sectionId', 'name')
    .populate({
      path: 'subjectComponentId',
      populate: {
        path: 'subjectId',
        select: 'name code shortName deliveryType'
      }
    })
    .populate('academicYearId', 'name');

  res.json({
    success: true,
    message: 'Faculty Assignment updated successfully',
    data: { assignment }
  });
});

export const deleteFacultyAssignment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return next(new AppError('Invalid assignment id', 400));
  }

  const assignment = await FacultyAssignment.findByIdAndDelete(id);

  if (!assignment) {
    return next(new AppError('Faculty Assignment not found', 404));
  }

  res.json({
    success: true,
    message: 'Faculty Assignment deleted successfully',
    data: {}
  });
});

export const getAcademicStructure = catchAsync(async (req, res, next) => {
  const departmentId = req.user.departmentId;

  if (!departmentId) {
    return next(new AppError('Department not found for user', 400));
  }

  const academicYear = await AcademicYear.findOne({ isActive: true });

  if (!academicYear) {
    return next(new AppError('Active academic year not found', 404));
  }

  const currentYear = academicYear.startYear;

  const batches = await Batch.find({
    startYear: { $lte: currentYear },
    endYear: { $gt: currentYear }
  }).lean();

  const batchIds = batches.map((b) => b._id);

  const batchPrograms = await BatchProgram.find({
    departmentId,
    batchId: { $in: batchIds }
  })
    .populate({
      path: 'batchId',
      select: 'startYear endYear name'
    })
    .populate({
      path: 'departmentId',
      select: 'name code'
    })
    .populate({
      path: 'regulationId',
      select: 'name startYear totalSemesters'
    })
    .lean();

  const batchProgramIds = batchPrograms.map((bp) => bp._id);

  const sections = await Section.find({
    batchProgramId: { $in: batchProgramIds }
  }).select('_id batchProgramId');

  const sectionIds = sections.map((s) => s._id);

  const semesterData = await StudentAcademicRecord.aggregate([
    {
      $match: {
        academicYearId: academicYear._id,
        sectionId: { $in: sectionIds }
      }
    },
    {
      $lookup: {
        from: 'sections',
        localField: 'sectionId',
        foreignField: '_id',
        as: 'section'
      }
    },
    { $unwind: '$section' },
    {
      $group: {
        _id: '$section.batchProgramId',
        semesterNumber: { $max: '$semesterNumber' }
      }
    }
  ]);

  const semesterMap = {};

  semesterData.forEach((item) => {
    semesterMap[item._id.toString()] = item.semesterNumber;
  });

  const academicStructure = batchPrograms.map((bp) => {
    const year = currentYear - bp.batchId.startYear + 1;
    const semester = semesterMap[bp._id.toString()] || null;

    return {
      year,
      semester,
      batchProgramId: bp._id,
      batch: bp.batchId,
      department: bp.departmentId,
      regulation: bp.regulationId
    };
  });

  academicStructure.sort((a, b) => a.year - b.year);

  res.json({
    success: true,
    message: 'Academic structure retrieved successfully',
    data: { academicStructure }
  });
});
