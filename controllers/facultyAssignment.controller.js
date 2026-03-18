import mongoose from 'mongoose';
import FacultyAssignment from '../models/FacultyAssignment.js';
import Faculty from '../models/Faculty.js';
import Section from '../models/Section.js';
import Subject from '../models/Subject.js';
import SubjectComponent from '../models/SubjectComponent.js';
import Batch from '../models/Batch.js';
import BatchProgram from '../models/BatchProgram.js';
import AcademicYear from '../models/AcademicYear.js';
import StudentAcademicRecord from '../models/StudentAcademicRecord.js';
import Curriculum from '../models/Curriculum.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createFacultyAssignment = catchAsync(async (req, res, next) => {
  const { allocations, sectionId, academicYearId, semesterNumber } = req.body;

  if (
    !allocations ||
    !Array.isArray(allocations) ||
    !sectionId ||
    !academicYearId ||
    !semesterNumber
  ) {
    return next(
      new AppError(
        'allocations[], sectionId, academicYearId, and semesterNumber are required',
        400
      )
    );
  }

  if (!isValidObjectId(sectionId) || !isValidObjectId(academicYearId)) {
    return next(new AppError('Invalid ObjectId provided', 400));
  }

  const [section, academicYear] = await Promise.all([
    Section.findById(sectionId).populate('batchProgramId'),
    AcademicYear.findById(academicYearId)
  ]);

  if (!section || !academicYear) {
    return next(
      new AppError('Referenced Section or AcademicYear not found', 404)
    );
  }

  const batchProgram = section.batchProgramId;

  const curriculum = await Curriculum.findOne({
    departmentId: batchProgram.departmentId,
    regulationId: batchProgram.regulationId,
    'semesters.semesterNumber': semesterNumber
  });

  if (!curriculum) {
    return next(
      new AppError(
        'Curriculum not found for this department, regulation, and semester',
        400
      )
    );
  }

  const semester = curriculum.semesters.find(
    (s) => s.semesterNumber === Number(semesterNumber)
  );

  const subjectComponentIds = allocations.map((a) => a.subjectComponentId);

  const subjectComponents = await SubjectComponent.find({
    _id: { $in: subjectComponentIds }
  }).populate('subjectId');

  const componentMap = new Map();
  subjectComponents.forEach((c) => componentMap.set(c._id.toString(), c));

  const allFacultyIds = allocations.flatMap((a) => a.facultyIds || []);
  const uniqueFacultyIds = [...new Set(allFacultyIds)];

  const faculties = await Faculty.find({
    _id: { $in: uniqueFacultyIds }
  });

  if (faculties.length !== uniqueFacultyIds.length) {
    return next(new AppError('One or more faculties not found', 404));
  }

  const existingAssignments = await FacultyAssignment.find({
    sectionId,
    academicYearId,
    semesterNumber,
    subjectComponentId: { $in: subjectComponentIds }
  });

  const existingMap = new Map();
  existingAssignments.forEach((a) =>
    existingMap.set(a.subjectComponentId.toString(), a)
  );

  const bulkOps = [];

  for (const allocation of allocations) {
    const { subjectComponentId, facultyIds = [] } = allocation;

    const component = componentMap.get(subjectComponentId);

    if (!component) {
      return next(new AppError('SubjectComponent not found', 404));
    }

    const subject = component.subjectId;

    if (
      !semester.subjects.some((id) => id.toString() === subject._id.toString())
    ) {
      return next(
        new AppError(
          `Subject ${subject.name} is not part of this semester curriculum`,
          400
        )
      );
    }

    const existing = existingMap.get(subjectComponentId);

    if (existing) {
      if (facultyIds.length === 0) {
        bulkOps.push({
          deleteOne: { filter: { _id: existing._id } }
        });
      } else {
        bulkOps.push({
          updateOne: {
            filter: { _id: existing._id },
            update: { facultyIds }
          }
        });
      }
    } else {
      if (facultyIds.length === 0) continue;

      bulkOps.push({
        insertOne: {
          document: {
            facultyIds,
            sectionId,
            subjectComponentId,
            academicYearId,
            semesterNumber,
            assignedBy: req.user?._id || null,
            status: 'active'
          }
        }
      });
    }
  }

  if (bulkOps.length) {
    await FacultyAssignment.bulkWrite(bulkOps);
  }

  const assignments = await FacultyAssignment.find({
    sectionId,
    academicYearId,
    semesterNumber
  });

  res.status(201).json({
    success: true,
    message: 'Faculty assignments processed successfully',
    data: { assignments }
  });
});

export const getAllFacultyAssignments = catchAsync(async (req, res, next) => {
  const { facultyId, sectionId, academicYearId, semesterNumber, status } =
    req.query;

  const filter = {};

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

  if (semesterNumber) {
    filter.semesterNumber = Number(semesterNumber);
  }

  if (status) {
    filter.status = status;
  }

  if (facultyId) {
    if (!isValidObjectId(facultyId))
      return next(new AppError('Invalid facultyId', 400));

    filter.facultyIds = { $in: [facultyId] };
  }

  const assignments = await FacultyAssignment.find(filter)
    .populate('facultyIds', 'firstName lastName employeeId')
    .populate('sectionId', 'name')
    .populate({
      path: 'subjectComponentId',
      populate: {
        path: 'subjectId',
        select: 'name code shortName deliveryType'
      }
    })
    .populate('academicYearId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
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

// to update
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
      academicYearId: academicYear._id,
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
