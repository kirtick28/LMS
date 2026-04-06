import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
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
import Topic from '../models/Topic.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

import crypto from 'crypto';

const generateUniqueJoinCode = async (ClassroomModel, session) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const codeLength = 6;

  let isUnique = false;
  let code = '';

  while (!isUnique) {
    const randomBytes = crypto.randomBytes(codeLength);
    code = '';
    for (let i = 0; i < codeLength; i++) {
      const randomIndex = randomBytes[i] % chars.length;
      code += chars[randomIndex];
    }
    const existing = await ClassroomModel.findOne({ joinCode: code }).session(
      session
    );
    if (!existing) isUnique = true;
  }

  return code;
};

const syncClassroomsAndMembers = async ({
  sectionId,
  academicYearId,
  semesterNumber,
  session
}) => {
  const assignments = await FacultyAssignment.find({
    sectionId,
    academicYearId,
    semesterNumber
  })
    .populate({
      path: 'subjectComponentId',
      populate: { path: 'subjectId' }
    })
    .lean()
    .session(session);

  if (!assignments.length) {
    const classrooms = await Classroom.find({
      sectionId,
      academicYearId,
      semesterNumber
    })
      .select('_id')
      .lean()
      .session(session);
    const classroomIds = classrooms.map((c) => c._id);
    if (classroomIds.length) {
      await ClassroomMember.deleteMany({
        classroomId: { $in: classroomIds },
        role: 'FACULTY'
      }).session(session);
    }
    return;
  }

  const subjectMap = new Map();
  const allFacultyIds = new Set();

  for (const a of assignments) {
    const comp = a.subjectComponentId;
    if (!comp || !comp.subjectId) continue;

    const subjectId = comp.subjectId._id.toString();

    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, {
        components: [],
        facultyIds: new Set()
      });
    }

    const group = subjectMap.get(subjectId);
    group.components.push(comp);

    for (const fid of a.facultyIds) {
      group.facultyIds.add(fid.toString());
      allFacultyIds.add(fid.toString());
    }
  }

  const subjectIds = [...subjectMap.keys()];

  const existingClassrooms = await Classroom.find({
    sectionId,
    academicYearId,
    semesterNumber,
    subjectId: { $in: subjectIds }
  })
    .lean()
    .session(session);

  const existingClassroomMap = new Map(
    existingClassrooms.map((c) => [c.subjectId.toString(), c])
  );

  const toCreate = subjectIds.filter((sid) => !existingClassroomMap.has(sid));
  if (toCreate.length) {
    const joinCode = await generateUniqueJoinCode(Classroom, session);
    const newRooms = toCreate.map((sid) => ({
      sectionId,
      subjectId: sid,
      academicYearId,
      semesterNumber,
      joinCode: joinCode || uuidv4().split('-')[0].toUpperCase(),
      status: 'active'
    }));
    const inserted = await Classroom.insertMany(newRooms, { session });
    inserted.forEach((doc) => {
      existingClassroomMap.set(doc.subjectId.toString(), doc);
    });
  }

  const allClassrooms = [...existingClassroomMap.values()];
  const classroomIds = allClassrooms.map((c) => c._id);

  let facultyUserMap = new Map();
  if (allFacultyIds.size) {
    const faculties = await Faculty.find({
      _id: { $in: [...allFacultyIds] }
    })
      .select('userId')
      .lean()
      .session(session);
    facultyUserMap = new Map(
      faculties.map((f) => [f._id.toString(), f.userId])
    );
  }

  const existingMembers = await ClassroomMember.find({
    classroomId: { $in: classroomIds },
    role: 'FACULTY'
  })
    .select('classroomId userId')
    .lean()
    .session(session);

  const existingMembersByClassroom = new Map();
  for (const m of existingMembers) {
    const cid = m.classroomId.toString();
    if (!existingMembersByClassroom.has(cid)) {
      existingMembersByClassroom.set(cid, new Set());
    }
    existingMembersByClassroom.get(cid).add(m.userId.toString());
  }

  const newMembersByClassroom = new Map();
  for (const [subjectId, group] of subjectMap) {
    const classroom = existingClassroomMap.get(subjectId);
    if (!classroom) continue;
    const cid = classroom._id.toString();
    const userIds = new Set();
    for (const fid of group.facultyIds) {
      const userId = facultyUserMap.get(fid);
      if (userId) userIds.add(userId.toString());
    }
    newMembersByClassroom.set(cid, userIds);
  }

  const memberOps = [];
  for (const [cid, newUserIds] of newMembersByClassroom) {
    const existingUserIds = existingMembersByClassroom.get(cid) || new Set();
    const toAdd = [...newUserIds].filter((uid) => !existingUserIds.has(uid));
    for (const uid of toAdd) {
      memberOps.push({
        updateOne: {
          filter: { classroomId: cid, userId: uid },
          update: { $set: { role: 'FACULTY', status: 'active' } },
          upsert: true
        }
      });
    }
    const toRemove = [...existingUserIds].filter((uid) => !newUserIds.has(uid));
    if (toRemove.length) {
      memberOps.push({
        deleteMany: {
          filter: {
            classroomId: cid,
            userId: { $in: toRemove },
            role: 'FACULTY'
          }
        }
      });
    }
  }

  if (memberOps.length) {
    await ClassroomMember.bulkWrite(memberOps, { session });
  }

  const existingTopics = await Topic.find({
    classroomId: { $in: classroomIds }
  })
    .lean()
    .session(session);

  const existingTopicsByClassroom = new Map();
  for (const t of existingTopics) {
    const cid = t.classroomId.toString();
    if (!existingTopicsByClassroom.has(cid)) {
      existingTopicsByClassroom.set(cid, new Set());
    }
    existingTopicsByClassroom.get(cid).add(t.name);
  }

  const topicOps = [];
  for (const [subjectId, group] of subjectMap) {
    const classroom = existingClassroomMap.get(subjectId);
    if (!classroom) continue;
    const cid = classroom._id.toString();
    const existingTopicNames = existingTopicsByClassroom.get(cid) || new Set();

    const requiredTopics = new Set();
    requiredTopics.add('No Topic');
    const componentTypes = group.components.map((c) => c.componentType);
    if (componentTypes.includes('PRACTICAL')) {
      requiredTopics.add('Laboratory');
    }
    if (componentTypes.includes('PROJECT')) {
      requiredTopics.add('Project');
    }

    const missing = [...requiredTopics].filter(
      (name) => !existingTopicNames.has(name)
    );
    if (missing.length) {
      const topicsToInsert = missing.map((name) => ({
        classroomId: cid,
        name,
        isDefault: name === 'No Topic'
      }));
      topicOps.push(...topicsToInsert);
    }
  }

  if (topicOps.length) {
    await Topic.insertMany(topicOps, { session });
  }
};

export const manageFacultyAssignments = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();

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

    await session.withTransaction(async () => {
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

      const componentIds = allocations.map((a) => a.subjectComponentId);

      const components = await SubjectComponent.find({
        _id: { $in: componentIds }
      })
        .populate('subjectId')
        .session(session);

      const compMap = new Map(components.map((c) => [c._id.toString(), c]));

      const facultyIds = [
        ...new Set(allocations.flatMap((a) => a.facultyIds || []))
      ];

      const count = await Faculty.countDocuments({
        _id: { $in: facultyIds }
      }).session(session);

      if (count !== facultyIds.length) {
        throw new AppError('Invalid facultyIds', 404);
      }

      const existing = await FacultyAssignment.find({
        sectionId,
        academicYearId,
        semesterNumber,
        subjectComponentId: { $in: componentIds }
      }).session(session);

      const existMap = new Map(
        existing.map((a) => [a.subjectComponentId.toString(), a])
      );

      const ops = [];

      for (const { subjectComponentId, facultyIds = [] } of allocations) {
        const comp = compMap.get(subjectComponentId);
        if (!comp) throw new AppError('Invalid subjectComponent', 404);

        const subject = comp.subjectId;

        if (
          !semester.subjects.some(
            (id) => id.toString() === subject._id.toString()
          )
        ) {
          throw new AppError(`Subject ${subject.name} not in curriculum`, 400);
        }

        const ex = existMap.get(subjectComponentId);

        if (ex) {
          if (facultyIds.length === 0) {
            ops.push({ deleteOne: { filter: { _id: ex._id } } });
          } else {
            ops.push({
              updateOne: {
                filter: { _id: ex._id },
                update: { facultyIds }
              }
            });
          }
        } else if (facultyIds.length) {
          ops.push({
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

      if (ops.length) {
        await FacultyAssignment.bulkWrite(ops, { session });
      }

      await syncClassroomsAndMembers({
        sectionId,
        academicYearId,
        semesterNumber,
        session
      });
    });

    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  } finally {
    await session.endSession();
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
