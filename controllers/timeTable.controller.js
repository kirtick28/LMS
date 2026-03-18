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
              '_id userId departmentId salutation firstName lastName designation qualification'
          }
        ]
      })
      .populate({
        path: 'additionalHourId',
        populate: {
          path: 'facultyIds',
          select:
            '_id userId departmentId salutation firstName lastName designation qualification'
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
      '_id userId departmentId salutation firstName lastName designation qualification'
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
    additionalHours
  } = req.body;

  if (!sectionId || !academicYearId || !semesterNumber) {
    return next(new AppError('Missing identifiers', 400));
  }

  let timetable = await Timetable.findOne({
    sectionId,
    academicYearId,
    semesterNumber
  });

  if (!timetable) {
    timetable = await Timetable.create({
      sectionId,
      academicYearId,
      semesterNumber,
      slots
    });
  } else {
    timetable.slots = slots;
    await timetable.save();
  }

  // 🔥 SLOT SHIFT LOGIC
  const classSlotOrders = slots
    .filter((s) => s.type === 'class')
    .map((s) => s.order);

  const slotShiftMap = {};
  let classIndex = 0;

  for (const slot of slots) {
    if (slot.type === 'class') {
      slotShiftMap[slot.order] = classSlotOrders[classIndex++];
    } else {
      slotShiftMap[slot.order] = null;
    }
  }

  await TimetableEntry.deleteMany({ timetableId: timetable._id });

  // 🔥 HANDLE ADDITIONAL HOURS (ONLY ONCE)
  let additionalHourIdMap = {};

  if (additionalHours && additionalHours.length > 0) {
    additionalHours.forEach((hour) => {
      if (
        !hour._id &&
        hour.additionalHourId &&
        typeof hour.additionalHourId === 'string' &&
        hour.additionalHourId.startsWith('temp-')
      ) {
        hour.tempId = hour.additionalHourId;
      }
    });

    const bulkOps = additionalHours.map((hour) => {
      const data = {
        name: hour.name,
        shortName: hour.shortName,
        facultyIds: hour.facultyIds || [],
        venue: hour.venue || '',
        hours: hour.hours || 1,
        sectionId,
        academicYearId,
        semesterNumber
      };

      if (hour.tempId) data.tempId = hour.tempId;

      if (hour._id) {
        return {
          updateOne: {
            filter: { _id: hour._id },
            update: data
          }
        };
      }

      return {
        insertOne: {
          document: data
        }
      };
    });

    await AdditionalHour.bulkWrite(bulkOps);

    // 🔥 MAP temp → real IDs
    const tempHours = additionalHours.filter(
      (h) => h._id === undefined && h.tempId
    );

    const allAdditionalHours = await AdditionalHour.find({
      sectionId,
      academicYearId,
      semesterNumber
    });

    tempHours.forEach((tempHour) => {
      const match = allAdditionalHours.find(
        (h) => h.tempId === tempHour.tempId
      );
      if (match) {
        additionalHourIdMap[tempHour.tempId] = match._id;
      }
    });
  }

  // 🔥 CREATE ENTRIES
  const entryDocs = entries
    .map((e) => {
      const newSlot = slotShiftMap[e.slotOrder];
      if (!newSlot) return null;

      let additionalHourId = e.additionalHourId;

      if (
        additionalHourId &&
        typeof additionalHourId === 'string' &&
        additionalHourId.startsWith('temp-') &&
        additionalHourIdMap[additionalHourId]
      ) {
        additionalHourId = additionalHourIdMap[additionalHourId];
      }

      return {
        ...e,
        slotOrder: newSlot,
        timetableId: timetable._id,
        additionalHourId
      };
    })
    .filter(Boolean);

  const createdEntries = await TimetableEntry.insertMany(entryDocs);

  // 🔥 UPDATE FACULTY ASSIGNMENTS
  if (facultyAssignments && facultyAssignments.length > 0) {
    const bulkUpdates = facultyAssignments.map((fa) => ({
      updateOne: {
        filter: { _id: fa._id },
        update: { $set: { venue: fa.venue } }
      }
    }));

    await FacultyAssignment.bulkWrite(bulkUpdates);
  }

  res.status(200).json({
    success: true,
    status: 'success',
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
