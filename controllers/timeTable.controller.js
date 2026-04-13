import AcademicCalendar from '../models/AcademicCalendar.js';
import AcademicYear from '../models/AcademicYear.js';
import AdditionalHour from '../models/AdditionalHour.js';
import FacultyAssignment from '../models/FacultyAssignment.js';
import Section from '../models/Section.js';
import Timetable from '../models/Timetable.js';
import TimetableEntry from '../models/TimetableEntry.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import mongoose from 'mongoose';

export const getTimetableEntriesForAttendance = catchAsync(
  async (req, res, next) => {
    const { sectionId, academicYearId, semesterNumber, facultyAssignmentId } =
      req.query;

    if (
      !sectionId ||
      !academicYearId ||
      !semesterNumber ||
      !facultyAssignmentId
    ) {
      return next(
        new AppError('Missing required parameters for attendance fetch', 400)
      );
    }

    // 1. Get the current day in 'MON', 'TUE', etc. format
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const todayName = days[new Date().getDay()];

    // 2. Find the relevant Timetable
    const timetable = await Timetable.findOne({
      sectionId,
      academicYearId,
      semesterNumber
    });

    if (!timetable) {
      return res
        .status(200)
        .json({ success: true, data: { slots: [], entries: [] } });
    }

    // 3. Find Entries for this specific FacultyAssignment/Subject on Today
    const entries = await TimetableEntry.find({
      timetableId: timetable._id,
      day: todayName,
      facultyAssignmentId
    }).sort({ slotOrder: 1 });

    // Return empty arrays if no entries exist for the specific subject today
    res.status(200).json({
      success: true,
      data: {
        slots: timetable.slots, // Provide slot timings for the UI
        entries: entries || []
      }
    });
  }
);

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

export const getFacultyTimetable = catchAsync(async (req, res, next) => {
  const { facultyId, academicYearId, semesterNumber } = req.query;

  if (!facultyId) {
    return next(new AppError('Faculty ID is required', 400));
  }

  if (!mongoose.Types.ObjectId.isValid(facultyId)) {
    return next(new AppError('Invalid faculty ID format', 400));
  }

  // Determine current academic year and semester if not provided
  let targetAcademicYearId = academicYearId;
  let targetSemesterNumber = semesterNumber;

  if (!targetAcademicYearId || !targetSemesterNumber) {
    const currentAcademicYear = await AcademicYear.findOne({
      isActive: true
    }).lean();
    if (!currentAcademicYear) {
      return next(new AppError('No active academic year found', 400));
    }
    targetAcademicYearId = currentAcademicYear._id;
    targetSemesterNumber = currentAcademicYear.currentSemester; // adjust field name if needed
    if (!targetSemesterNumber) {
      return next(
        new AppError('Current semester not set for academic year', 400)
      );
    }
  }

  // Step 1: Find FacultyAssignments for this faculty in the given academic year and semester
  const facultyAssignments = await FacultyAssignment.find({
    facultyIds: facultyId,
    academicYearId: targetAcademicYearId,
    semesterNumber: targetSemesterNumber,
    status: 'active'
  }).select('_id sectionId');

  const faIds = facultyAssignments.map((fa) => fa._id);
  const sectionIds = [
    ...new Set(facultyAssignments.map((fa) => fa.sectionId.toString()))
  ];

  // Step 2: Find AdditionalHours for this faculty in the same academic year and semester
  const additionalHours = await AdditionalHour.find({
    facultyIds: facultyId,
    academicYearId: targetAcademicYearId,
    semesterNumber: targetSemesterNumber
  }).select('_id');

  const ahIds = additionalHours.map((ah) => ah._id);

  // Step 3: Fetch TimetableEntries
  const entries = await TimetableEntry.find({
    $or: [
      { facultyAssignmentId: { $in: faIds } },
      { additionalHourId: { $in: ahIds } }
    ]
  }).lean();

  if (entries.length === 0) {
    return res.status(200).json({
      success: true,
      data: { slots: [], grid: {} }
    });
  }

  // Step 4: Get unique timetableIds and fetch corresponding timetables
  const timetableIds = [
    ...new Set(entries.map((e) => e.timetableId.toString()))
  ];
  const timetables = await Timetable.find({ _id: { $in: timetableIds } })
    .select('slots')
    .lean();

  const timetableMap = new Map(timetables.map((t) => [t._id.toString(), t]));

  // Step 5: Get slots from the first timetable (assume they are consistent across sections)
  const firstTimetable = timetables[0];
  const slots = firstTimetable
    ? firstTimetable.slots.sort((a, b) => a.order - b.order)
    : [];

  // Step 6: Pre‑fetch section details with batchProgram
  const sectionDetailsMap = new Map();
  if (sectionIds.length) {
    const sections = await Section.find({ _id: { $in: sectionIds } })
      .populate({
        path: 'batchProgramId',
        populate: [
          { path: 'batchId', select: 'year' },
          { path: 'departmentId', select: 'code name' }
        ]
      })
      .lean();
    for (const sec of sections) {
      sectionDetailsMap.set(sec._id.toString(), sec);
    }
  }

  // Step 7: Pre‑fetch facultyAssignments with subject details
  const faDetailsMap = new Map();
  if (faIds.length) {
    const fas = await FacultyAssignment.find({ _id: { $in: faIds } })
      .populate({
        path: 'subjectComponentId',
        populate: { path: 'subjectId' }
      })
      .lean();
    for (const fa of fas) {
      faDetailsMap.set(fa._id.toString(), fa);
    }
  }

  // Step 8: Pre‑fetch additional hours
  const ahDetailsMap = new Map();
  if (ahIds.length) {
    const ahs = await AdditionalHour.find({ _id: { $in: ahIds } }).lean();
    for (const ah of ahs) {
      ahDetailsMap.set(ah._id.toString(), ah);
    }
  }

  // Step 9: Build the grid
  const grid = {};

  for (const entry of entries) {
    const timetable = timetableMap.get(entry.timetableId.toString());
    if (!timetable) continue;

    const day = entry.day;
    const slotOrder = entry.slotOrder;

    if (!grid[day]) grid[day] = {};
    if (!grid[day][slotOrder]) grid[day][slotOrder] = [];

    if (entry.facultyAssignmentId) {
      const fa = faDetailsMap.get(entry.facultyAssignmentId.toString());
      if (fa) {
        const section = sectionDetailsMap.get(fa.sectionId.toString());
        const subjectComp = fa.subjectComponentId;
        const subject = subjectComp?.subjectId;

        grid[day][slotOrder].push({
          type: 'regular',
          sectionName: section?.name || '',
          batchYear: section?.batchProgramId?.batchId?.year || '',
          departmentCode: section?.batchProgramId?.departmentId?.code || '',
          subjectCode: subject?.code || '',
          subjectShortName: subjectComp?.shortName || subject?.shortName || '',
          componentType: subjectComp?.componentType || '',
          venue: fa.venue || ''
        });
      }
    } else if (entry.additionalHourId) {
      const ah = ahDetailsMap.get(entry.additionalHourId.toString());
      if (ah) {
        const section = sectionDetailsMap.get(ah.sectionId.toString());
        grid[day][slotOrder].push({
          type: 'additional',
          sectionName: section?.name || '',
          batchYear: section?.batchProgramId?.batchId?.year || '',
          departmentCode: section?.batchProgramId?.departmentId?.code || '',
          name: ah.name,
          shortName: ah.shortName,
          venue: ah.venue || ''
        });
      }
    }
  }

  res.status(200).json({
    success: true,
    data: {
      slots,
      grid,
      academicYearId: targetAcademicYearId,
      semesterNumber: targetSemesterNumber
    }
  });
});

async function validateFacultyClash({
  timetableId,
  entries,
  facultyAssignments,
  additionalHours
}) {
  const incomingMap = new Map();

  const addToMap = (day, slotOrder, facultyIds) => {
    const key = `${day}_${slotOrder}`;
    if (!incomingMap.has(key)) {
      incomingMap.set(key, new Set());
    }
    const set = incomingMap.get(key);
    facultyIds.forEach((fid) => set.add(fid.toString()));
  };

  const regularEntries = entries.filter((e) => e.facultyAssignmentId);
  const faIds = regularEntries
    .map((e) => e.facultyAssignmentId)
    .filter((id) => id);
  let faDocs = facultyAssignments;
  if (!faDocs && faIds.length) {
    faDocs = await FacultyAssignment.find({ _id: { $in: faIds } })
      .select('facultyIds')
      .lean();
  }
  const faMap = new Map();
  if (faDocs) {
    for (const fa of faDocs) {
      faMap.set(
        fa._id.toString(),
        fa.facultyIds.map((id) => id.toString())
      );
    }
  }

  for (const entry of regularEntries) {
    const facultyIds = faMap.get(entry.facultyAssignmentId.toString());
    if (facultyIds && facultyIds.length) {
      addToMap(entry.day, entry.slotOrder, facultyIds);
    }
  }

  const ahEntries = entries.filter((e) => e.additionalHourId);
  const ahIds = ahEntries.map((e) => e.additionalHourId).filter((id) => id);
  let ahDocs = additionalHours;
  if (!ahDocs && ahIds.length) {
    ahDocs = await AdditionalHour.find({ _id: { $in: ahIds } })
      .select('facultyIds')
      .lean();
  }
  const ahMap = new Map();
  if (ahDocs) {
    for (const ah of ahDocs) {
      ahMap.set(
        ah._id.toString(),
        ah.facultyIds.map((id) => id.toString())
      );
    }
  }

  for (const entry of ahEntries) {
    const facultyIds = ahMap.get(entry.additionalHourId.toString());
    if (facultyIds && facultyIds.length) {
      addToMap(entry.day, entry.slotOrder, facultyIds);
    }
  }

  for (const [key, facultySet] of incomingMap.entries()) {
  }

  const incomingFacultyList = new Map();
  for (const entry of regularEntries) {
    const facultyIds = faMap.get(entry.facultyAssignmentId.toString());
    if (facultyIds) {
      const key = `${entry.day}_${entry.slotOrder}`;
      if (!incomingFacultyList.has(key)) incomingFacultyList.set(key, []);
      incomingFacultyList.get(key).push(...facultyIds);
    }
  }
  for (const entry of ahEntries) {
    const facultyIds = ahMap.get(entry.additionalHourId.toString());
    if (facultyIds) {
      const key = `${entry.day}_${entry.slotOrder}`;
      if (!incomingFacultyList.has(key)) incomingFacultyList.set(key, []);
      incomingFacultyList.get(key).push(...facultyIds);
    }
  }

  for (const [key, facultyIds] of incomingFacultyList.entries()) {
    const seen = new Set();
    for (const fid of facultyIds) {
      if (seen.has(fid)) {
        throw new AppError(
          `Conflict within new timetable: Faculty ${fid} is assigned to multiple classes on ${key}`,
          400
        );
      }
      seen.add(fid);
    }
  }

  if (incomingFacultyList.size === 0) return;

  const orConditions = [];
  for (const [key, facultyIds] of incomingFacultyList.entries()) {
    const [day, slotOrder] = key.split('_');
  }

  const allConflictFacultyIds = [
    ...new Set([...incomingFacultyList.values()].flat())
  ];
  const conflictingFAs = await FacultyAssignment.find({
    facultyIds: { $in: allConflictFacultyIds },
    status: 'active'
  })
    .select('_id')
    .lean();
  const conflictingFAIds = conflictingFAs.map((fa) => fa._id);

  const conflictingAHs = await AdditionalHour.find({
    facultyIds: { $in: allConflictFacultyIds }
  })
    .select('_id')
    .lean();
  const conflictingAHIds = conflictingAHs.map((ah) => ah._id);

  const conflictCandidates = await TimetableEntry.find({
    timetableId: { $ne: timetableId },
    $or: [
      { facultyAssignmentId: { $in: conflictingFAIds } },
      { additionalHourId: { $in: conflictingAHIds } }
    ]
  }).lean();

  const candidateFAIds = [
    ...new Set(
      conflictCandidates.map((c) => c.facultyAssignmentId).filter((id) => id)
    )
  ];
  const candidateAHIds = [
    ...new Set(
      conflictCandidates.map((c) => c.additionalHourId).filter((id) => id)
    )
  ];

  let candidateFAMap = new Map();
  let candidateAHMap = new Map();

  if (candidateFAIds.length) {
    const fas = await FacultyAssignment.find({ _id: { $in: candidateFAIds } })
      .select('facultyIds')
      .lean();
    for (const fa of fas) {
      candidateFAMap.set(
        fa._id.toString(),
        fa.facultyIds.map((id) => id.toString())
      );
    }
  }
  if (candidateAHIds.length) {
    const ahs = await AdditionalHour.find({ _id: { $in: candidateAHIds } })
      .select('facultyIds')
      .lean();
    for (const ah of ahs) {
      candidateAHMap.set(
        ah._id.toString(),
        ah.facultyIds.map((id) => id.toString())
      );
    }
  }

  const existingConflicts = new Set();
  for (const cand of conflictCandidates) {
    let facultyIds = [];
    if (cand.facultyAssignmentId) {
      facultyIds =
        candidateFAMap.get(cand.facultyAssignmentId.toString()) || [];
    } else if (cand.additionalHourId) {
      facultyIds = candidateAHMap.get(cand.additionalHourId.toString()) || [];
    }
    const key = `${cand.day}_${cand.slotOrder}`;
    for (const fid of facultyIds) {
      existingConflicts.add(`${fid}_${key}`);
    }
  }

  for (const [key, facultyIds] of incomingFacultyList.entries()) {
    for (const fid of facultyIds) {
      if (existingConflicts.has(`${fid}_${key}`)) {
        throw new AppError(
          `Faculty ${fid} is already assigned to a class on ${key} (${key.replace('_', ' ')}).`,
          400
        );
      }
    }
  }
}

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

  const timetable = await Timetable.findOneAndUpdate(
    { sectionId, academicYearId, semesterNumber },
    { $set: { slots } },
    { new: true, upsert: true }
  );

  const classSlots = slots
    .filter((s) => s.type === 'class')
    .map((s) => s.order);
  const slotShiftMap = {};

  let idx = 0;
  for (const slot of slots) {
    slotShiftMap[slot.order] = slot.type === 'class' ? classSlots[idx++] : null;
  }

  const regularEntryFAs = entries
    .filter((e) => e.facultyAssignmentId && !e.additionalHourId)
    .map((e) => e.facultyAssignmentId)
    .filter((id) => id);
  const additionalHourIds = entries
    .filter((e) => e.additionalHourId)
    .map((e) => e.additionalHourId)
    .filter((id) => id);

  let existingFAs = [];
  let existingAHs = [];

  if (regularEntryFAs.length) {
    existingFAs = await FacultyAssignment.find({
      _id: { $in: regularEntryFAs }
    }).lean();
  }
  if (additionalHourIds.length) {
    existingAHs = await AdditionalHour.find({
      _id: { $in: additionalHourIds }
    }).lean();
  }

  const additionalHourDocs = [];
  for (const ah of additionalHours) {
    if (ah._id) {
    } else {
      additionalHourDocs.push(ah);
    }
  }

  const entriesForValidation = [];

  for (const e of entries) {
    if (e.facultyAssignmentId && !e.additionalHourId) {
      const fa = existingFAs.find(
        (f) => f._id.toString() === e.facultyAssignmentId
      );
      if (fa) {
        entriesForValidation.push({
          day: e.day,
          slotOrder: e.slotOrder,
          facultyAssignmentId: e.facultyAssignmentId,
          facultyIds: fa.facultyIds.map((id) => id.toString())
        });
      } else {
      }
    }
  }

  for (const e of entries) {
    if (e.additionalHourId) {
      let facultyIds = [];
      if (e.additionalHourId.startsWith('temp-')) {
        const newAH = additionalHours.find(
          (ah) => ah.tempId === e.additionalHourId
        );
        if (newAH && newAH.facultyIds) {
          facultyIds = newAH.facultyIds.map((id) => id.toString());
        }
      } else {
        const existingAH = existingAHs.find(
          (ah) => ah._id.toString() === e.additionalHourId
        );
        if (existingAH) {
          facultyIds = existingAH.facultyIds.map((id) => id.toString());
        }
      }
      if (facultyIds.length) {
        entriesForValidation.push({
          day: e.day,
          slotOrder: e.slotOrder,
          additionalHourId: e.additionalHourId,
          facultyIds
        });
      }
    }
  }

  await validateFacultyClash({
    timetableId: timetable._id,
    entries: entriesForValidation,
    facultyAssignments: existingFAs,
    additionalHours: existingAHs
  });

  await TimetableEntry.deleteMany({ timetableId: timetable._id });

  let additionalHourIdMap = {};

  if (additionalHours.length > 0) {
    for (const h of additionalHours) {
      if (
        !h._id &&
        typeof h.additionalHourId === 'string' &&
        h.additionalHourId.startsWith('temp-')
      ) {
        h.tempId = h.additionalHourId;
      }
    }

    const existing = await AdditionalHour.find(
      { sectionId, academicYearId, semesterNumber },
      { _id: 1, tempId: 1 }
    ).lean();

    const existingIdSet = new Set(existing.map((e) => e._id.toString()));
    const incomingIdSet = new Set(
      additionalHours.filter((h) => h._id).map((h) => h._id.toString())
    );

    const idsToDelete = [];
    for (const e of existing) {
      if (!incomingIdSet.has(e._id.toString())) {
        idsToDelete.push(e._id);
      }
    }

    if (idsToDelete.length) {
      await AdditionalHour.deleteMany({ _id: { $in: idsToDelete } });
    }

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
