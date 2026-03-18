import Timetable from '../models/Timetable.js';
import TimetableEntry from '../models/TimetableEntry.js';
import AdditionalHour from '../models/AdditionalHour.js';
import FacultyAssignment from '../models/FacultyAssignment.js';

import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

export const getTimetableFull = catchAsync(async (req, res, next) => {
  const { sectionId, academicYearId, semesterNumber } = req.query;

  if (!sectionId || !academicYearId || !semesterNumber) {
    return next(new AppError('Missing identifiers', 400));
  }

  const timetable = await Timetable.findOne({
    sectionId,
    academicYearId,
    semesterNumber
  });

  let entries = [];

  if (timetable) {
    entries = await TimetableEntry.find({
      timetableId: timetable._id
    })
      .populate({
        path: 'facultyAssignmentId',
        populate: [
          {
            path: 'subjectComponentId',
            populate: { path: 'subjectId' }
          },
          {
            path: 'facultyIds',
            select:
              '_id userId departmentId salutation firstName lastName designation qualification deptCode',
            populate: {
              path: 'departmentId',
              select: 'name code'
            }
          }
        ]
      })
      .populate({
        path: 'additionalHourId',
        populate: {
          path: 'facultyIds',
          select:
            '_id userId departmentId salutation firstName lastName designation qualification deptCode',
          populate: {
            path: 'departmentId',
            select: 'name code'
          }
        }
      });
  }

  const facultyAssignments = await FacultyAssignment.find({
    sectionId,
    academicYearId,
    semesterNumber,
    status: 'active'
  })
    .populate({
      path: 'subjectComponentId',
      populate: { path: 'subjectId' }
    })
    .populate({
      path: 'facultyIds',
      select:
        '_id userId departmentId salutation firstName lastName designation qualification',
      populate: {
        path: 'departmentId',
        select: 'name code'
      }
    });

  const additionalHours = await AdditionalHour.find({
    sectionId,
    academicYearId,
    semesterNumber
  }).populate({
    path: 'facultyIds',
    select:
      '_id userId departmentId salutation firstName lastName designation qualification',
    populate: {
      path: 'departmentId',
      select: 'name code'
    }
  });

  res.status(200).json({
    success: true,
    status: 'success',
    data: {
      timetable: timetable || null,
      slots: timetable ? timetable.slots : [],
      entries,
      facultyAssignments,
      additionalHours
    }
  });
});

export const saveTimetableFull = catchAsync(async (req, res, next) => {
  const {
    sectionId,
    academicYearId,
    semesterNumber,
    slots,
    entries,
    facultyAssignments,
    additionalHours = []
  } = req.body;

  if (!sectionId || !academicYearId || !semesterNumber) {
    return next(new AppError('Missing identifiers', 400));
  }

  // 🔥 UPSERT TIMETABLE (1 query instead of find + create/save)
  const timetable = await Timetable.findOneAndUpdate(
    { sectionId, academicYearId, semesterNumber },
    { $set: { slots } },
    { new: true, upsert: true }
  );

  // 🔥 SLOT SHIFT (O(n))
  const classSlots = slots
    .filter((s) => s.type === 'class')
    .map((s) => s.order);
  const slotShiftMap = {};

  let idx = 0;
  for (const slot of slots) {
    slotShiftMap[slot.order] = slot.type === 'class' ? classSlots[idx++] : null;
  }

  // 🔥 DELETE OLD ENTRIES (1 query)
  await TimetableEntry.deleteMany({ timetableId: timetable._id });

  // 🔥 HANDLE ADDITIONAL HOURS (OPTIMIZED)
  let additionalHourIdMap = {};

  if (additionalHours.length > 0) {
    // normalize tempIds
    for (const h of additionalHours) {
      if (
        !h._id &&
        typeof h.additionalHourId === 'string' &&
        h.additionalHourId.startsWith('temp-')
      ) {
        h.tempId = h.additionalHourId;
      }
    }

    // 🔥 FETCH ONLY IDs (lean + minimal data)
    const existing = await AdditionalHour.find(
      { sectionId, academicYearId, semesterNumber },
      { _id: 1, tempId: 1 }
    ).lean();

    const existingIdSet = new Set(existing.map((e) => e._id.toString()));
    const incomingIdSet = new Set(
      additionalHours.filter((h) => h._id).map((h) => h._id.toString())
    );

    // 🔥 DELETE (O(n))
    const idsToDelete = [];
    for (const e of existing) {
      if (!incomingIdSet.has(e._id.toString())) {
        idsToDelete.push(e._id);
      }
    }

    if (idsToDelete.length) {
      await AdditionalHour.deleteMany({ _id: { $in: idsToDelete } });
    }

    // 🔥 BULK WRITE (single call)
    const bulkOps = additionalHours.map((h) => {
      const data = {
        name: h.name,
        shortName: h.shortName,
        facultyIds: h.facultyIds || [],
        venue: h.venue || '',
        hours: h.hours || 1,
        sectionId,
        academicYearId,
        semesterNumber,
        ...(h.tempId && { tempId: h.tempId })
      };

      return h._id
        ? {
            updateOne: {
              filter: { _id: h._id },
              update: data
            }
          }
        : {
            insertOne: {
              document: data
            }
          };
    });

    if (bulkOps.length) {
      await AdditionalHour.bulkWrite(bulkOps);
    }

    // 🔥 BUILD tempId → _id map (NO nested loop)
    const tempMap = {};
    for (const e of existing) {
      if (e.tempId) tempMap[e.tempId] = e._id;
    }

    if (additionalHours.some((h) => h.tempId && !h._id)) {
      const latest = await AdditionalHour.find(
        { sectionId, academicYearId, semesterNumber },
        { _id: 1, tempId: 1 }
      ).lean();

      for (const h of latest) {
        if (h.tempId) tempMap[h.tempId] = h._id;
      }
    }

    additionalHourIdMap = tempMap;
  }

  // 🔥 CREATE ENTRIES (O(n))
  const entryDocs = [];

  for (const e of entries) {
    const newSlot = slotShiftMap[e.slotOrder];
    if (!newSlot) continue;

    let additionalHourId = e.additionalHourId;

    if (
      additionalHourId &&
      typeof additionalHourId === 'string' &&
      additionalHourId.startsWith('temp-')
    ) {
      additionalHourId = additionalHourIdMap[additionalHourId];
    }

    entryDocs.push({
      ...e,
      slotOrder: newSlot,
      timetableId: timetable._id,
      additionalHourId
    });
  }

  const createdEntries = await TimetableEntry.insertMany(entryDocs);

  // 🔥 BULK UPDATE FACULTY ASSIGNMENTS
  if (facultyAssignments?.length) {
    await FacultyAssignment.bulkWrite(
      facultyAssignments.map((fa) => ({
        updateOne: {
          filter: { _id: fa._id },
          update: { $set: { venue: fa.venue } }
        }
      }))
    );
  }

  res.status(200).json({
    success: true,
    data: {
      timetableId: timetable._id,
      entriesSaved: createdEntries.length
    }
  });
});

export const getComponents = catchAsync(async (req, res, next) => {
  const { sectionId, academicYearId, semesterNumber } = req.query;

  if (!sectionId || !academicYearId || !semesterNumber) {
    return next(new AppError('Missing identifiers', 400));
  }

  const facultyAssignments = await FacultyAssignment.find({
    sectionId,
    academicYearId,
    semesterNumber,
    status: 'active'
  })
    .populate({
      path: 'subjectComponentId',
      populate: { path: 'subjectId' }
    })
    .populate({
      path: 'facultyIds',
      select:
        '_id userId departmentId salutation firstName lastName designation qualification'
    });

  const subjectComponents = facultyAssignments.map((fa) => ({
    facultyAssignmentId: fa._id,
    subjectComponent: fa.subjectComponentId,
    facultyIds: fa.facultyIds,
    venue: fa.venue
  }));

  const additionalHours = await AdditionalHour.find({
    sectionId,
    academicYearId,
    semesterNumber
  }).populate({
    path: 'facultyIds',
    select:
      '_id userId departmentId salutation firstName lastName designation qualification'
  });

  res.status(200).json({
    success: true,
    status: 'success',
    data: {
      subjectComponents,
      additionalHours
    }
  });
});
