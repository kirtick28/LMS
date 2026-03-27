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
import Classroom from '../models/Classroom.js';
import ClassroomMember from '../models/ClassroomMember.js';
import Topic from '../models/Topic.js'; // Ensure Topic model is imported

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const fastSyncClassrooms = async ({
  sectionId,
  academicYearId,
  semesterNumber,
  session
}) => {
  const [assignments, classrooms] = await Promise.all([
    FacultyAssignment.find({
      sectionId,
      academicYearId,
      semesterNumber
    }).session(session),
    Classroom.find({ sectionId, academicYearId, semesterNumber }).session(
      session
    )
  ]);

  const assignmentMap = new Map(
    assignments.map((a) => [a.subjectComponentId.toString(), a])
  );

  const classroomMap = new Map(
    classrooms.map((c) => [c.subjectComponentId.toString(), c])
  );

  const classroomsToInsert = [];
  const classroomUpdates = [];

  // 🔥 CREATE / UPDATE
  for (const [subjectComponentId, assignment] of assignmentMap) {
    const existing = classroomMap.get(subjectComponentId);

    if (!existing) {
      classroomsToInsert.push({
        sectionId,
        subjectComponentId,
        academicYearId,
        semesterNumber,
        status: 'active'
      });
    } else if (existing.status !== 'active') {
      classroomUpdates.push({
        updateOne: {
          filter: { _id: existing._id },
          update: { status: 'active' }
        }
      });
    }
  }

  // 🔥 Handle New Classrooms and their Default Topics
  if (classroomsToInsert.length) {
    const newClassrooms = await Classroom.insertMany(classroomsToInsert, {
      session
    });

    // Create default "No Topic" for each newly created classroom
    const defaultTopics = newClassrooms.map((classroom) => ({
      classroomId: classroom._id,
      name: 'No Topic',
      isDefault: true
    }));

    if (defaultTopics.length) {
      await Topic.insertMany(defaultTopics, { session });
    }
  }

  if (classroomUpdates.length) {
    await Classroom.bulkWrite(classroomUpdates, { session });
  }

  // 🔥 REFETCH
  const finalClassrooms = await Classroom.find({
    sectionId,
    academicYearId,
    semesterNumber
  }).session(session);

  const finalMap = new Map(
    finalClassrooms.map((c) => [c.subjectComponentId.toString(), c])
  );

  // 🔥 MEMBER BULK OPS
  const memberOps = [];

  for (const [subjectComponentId, assignment] of assignmentMap) {
    const classroom = finalMap.get(subjectComponentId);

    assignment.facultyIds.forEach((fid) => {
      memberOps.push({
        updateOne: {
          filter: { classroomId: classroom._id, userId: fid },
          update: {
            $set: { role: 'faculty', status: 'active' }
          },
          upsert: true
        }
      });
    });
  }

  // 🔥 REMOVE OLD FACULTY
  for (const [subjectComponentId, classroom] of finalMap) {
    const assignment = assignmentMap.get(subjectComponentId);

    if (!assignment) {
      memberOps.push({
        updateMany: {
          filter: { classroomId: classroom._id, role: 'faculty' },
          update: { status: 'removed' }
        }
      });

      classroomUpdates.push({
        updateOne: {
          filter: { _id: classroom._id },
          update: { status: 'unassigned' }
        }
      });
    }
  }

  if (memberOps.length) {
    await ClassroomMember.bulkWrite(memberOps, { session });
  }

  if (classroomUpdates.length) {
    await Classroom.bulkWrite(classroomUpdates, { session });
  }
};

export const createFacultyAssignment = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { allocations, sectionId, academicYearId, semesterNumber } = req.body;

    if (
      !allocations ||
      !Array.isArray(allocations) ||
      !sectionId ||
      !academicYearId ||
      !semesterNumber
    ) {
      throw new AppError('Missing required fields', 400);
    }

    if (!isValidObjectId(sectionId) || !isValidObjectId(academicYearId)) {
      throw new AppError('Invalid ObjectId', 400);
    }

    const [section, academicYear] = await Promise.all([
      Section.findById(sectionId).populate('batchProgramId').session(session),
      AcademicYear.findById(academicYearId).session(session)
    ]);

    if (!section || !academicYear) {
      throw new AppError('Section or AcademicYear not found', 404);
    }

    const batchProgram = section.batchProgramId;

    const curriculum = await Curriculum.findOne({
      departmentId: batchProgram.departmentId,
      regulationId: batchProgram.regulationId,
      'semesters.semesterNumber': semesterNumber
    }).session(session);

    if (!curriculum) throw new AppError('Curriculum not found', 400);

    const semester = curriculum.semesters.find(
      (s) => s.semesterNumber === Number(semesterNumber)
    );

    const subjectComponentIds = allocations.map((a) => a.subjectComponentId);

    const subjectComponents = await SubjectComponent.find({
      _id: { $in: subjectComponentIds }
    })
      .populate('subjectId')
      .session(session);

    const componentMap = new Map(
      subjectComponents.map((c) => [c._id.toString(), c])
    );

    const allFacultyIds = [
      ...new Set(allocations.flatMap((a) => a.facultyIds || []))
    ];

    const facultiesCount = await Faculty.countDocuments({
      _id: { $in: allFacultyIds }
    }).session(session);

    if (facultiesCount !== allFacultyIds.length) {
      throw new AppError('Invalid facultyIds', 404);
    }

    const existingAssignments = await FacultyAssignment.find({
      sectionId,
      academicYearId,
      semesterNumber,
      subjectComponentId: { $in: subjectComponentIds }
    }).session(session);

    const existingMap = new Map(
      existingAssignments.map((a) => [a.subjectComponentId.toString(), a])
    );

    const bulkOps = [];

    for (const { subjectComponentId, facultyIds = [] } of allocations) {
      const component = componentMap.get(subjectComponentId);
      if (!component) throw new AppError('Invalid subjectComponent', 404);

      const subject = component.subjectId;

      if (
        !semester.subjects.some(
          (id) => id.toString() === subject._id.toString()
        )
      ) {
        throw new AppError(`Subject ${subject.name} not in curriculum`, 400);
      }

      const existing = existingMap.get(subjectComponentId);

      if (existing) {
        if (facultyIds.length === 0) {
          bulkOps.push({ deleteOne: { filter: { _id: existing._id } } });
        } else {
          bulkOps.push({
            updateOne: {
              filter: { _id: existing._id },
              update: { facultyIds }
            }
          });
        }
      } else if (facultyIds.length > 0) {
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
      await FacultyAssignment.bulkWrite(bulkOps, { session });
    }

    // 🔥 FAST CLASSROOM SYNC (Now creates default topics)
    await fastSyncClassrooms({
      sectionId,
      academicYearId,
      semesterNumber,
      session
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
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

export const getAcademicStructure = catchAsync(async (req, res, next) => {
  const { departmentId } = req.params;

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
