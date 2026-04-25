import AcademicCalendar from '../models/AcademicCalendar.js';
import AcademicYear from '../models/AcademicYear.js';
import AdditionalHour from '../models/AdditionalHour.js';
import Attendance from '../models/Attendance.js';
import AttendanceRequest from '../models/AttendanceRequest.js';
import Classroom from '../models/Classroom.js';
import Faculty from '../models/Faculty.js';
import FacultyAssignment from '../models/FacultyAssignment.js';
import Section from '../models/Section.js';
import SubjectComponent from '../models/SubjectComponent.js';
import Timetable from '../models/Timetable.js';
import TimetableEntry from '../models/TimetableEntry.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import mongoose from 'mongoose';

const toSubjectComponentPayload = (component) => {
  if (!component) return null;
  return {
    _id: component._id,
    name: component.name || '',
    shortName: component.shortName || '',
    componentType: component.componentType || ''
  };
};

const toSubjectPayload = (subject) => {
  if (!subject) return null;
  return {
    _id: subject._id,
    name: subject.name || '',
    code: subject.code || '',
    shortName: subject.shortName || ''
  };
};

const buildPeriodLabel = (slotOrder, component) => {
  const componentName = component?.shortName || component?.name;
  return componentName
    ? `Period ${slotOrder} - ${componentName}`
    : `Period ${slotOrder}`;
};

export const getTimetableEntriesForAttendance = catchAsync(
  async (req, res, next) => {
    const {
      classroomId,
      subjectId: rawSubjectId,
      sectionId: rawSectionId,
      academicYearId: rawAcademicYearId,
      semesterNumber: rawSemesterNumber,
      dateString,
      facultyId: rawFacultyId
    } = req.query;

    // Frontend should send only dateString (YYYY-MM-DD)
    if (!dateString) {
      return next(new AppError('dateString is required (YYYY-MM-DD)', 400));
    }

    const targetDateString = String(dateString);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateString)) {
      return next(
        new AppError('Invalid dateString format. Expected YYYY-MM-DD', 400)
      );
    }

    const parsedDate = new Date(`${targetDateString}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      return next(new AppError('Invalid dateString', 400));
    }

    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dayName = days[parsedDate.getUTCDay()];

    if (dayName === 'SUN') {
      return res.status(200).json({
        success: true,
        data: {
          dateString: targetDateString,
          day: dayName,
          slots: [],
          entries: [],
          attendanceSheets: []
        }
      });
    }

    // If the calendar explicitly marks this as a holiday, return empty.
    const calendarEntry = await AcademicCalendar.findOne({
      dateString: targetDateString
    })
      .select('isWorkingDay')
      .lean();

    if (calendarEntry && !calendarEntry.isWorkingDay) {
      return res.status(200).json({
        success: true,
        data: {
          dateString: targetDateString,
          day: dayName,
          slots: [],
          entries: [],
          attendanceSheets: []
        }
      });
    }

    // Resolve context from classroom when provided (preferred)
    let sectionId = rawSectionId;
    let academicYearId = rawAcademicYearId;
    let semesterNumber = rawSemesterNumber;
    let subjectId = rawSubjectId;

    let resolvedClassroomId = null;

    if (classroomId) {
      if (!mongoose.Types.ObjectId.isValid(classroomId)) {
        return next(new AppError('Invalid classroomId', 400));
      }

      const classroom = await Classroom.findById(classroomId)
        .select(
          'sectionId subjectId academicYearId semesterNumber status isDeleted'
        )
        .lean();

      if (!classroom || classroom.isDeleted || classroom.status !== 'active') {
        return next(new AppError('Classroom not found', 404));
      }

      resolvedClassroomId = classroomId;
      sectionId = classroom.sectionId;
      academicYearId = classroom.academicYearId;
      semesterNumber = classroom.semesterNumber;
      subjectId = classroom.subjectId;
    }

    if (!sectionId || !academicYearId || !semesterNumber || !subjectId) {
      return next(
        new AppError(
          'Provide classroomId OR (sectionId, academicYearId, semesterNumber, subjectId)',
          400
        )
      );
    }

    // Normalize/validate ids
    if (!mongoose.Types.ObjectId.isValid(String(sectionId))) {
      return next(new AppError('Invalid sectionId', 400));
    }
    if (!mongoose.Types.ObjectId.isValid(String(academicYearId))) {
      return next(new AppError('Invalid academicYearId', 400));
    }
    if (!mongoose.Types.ObjectId.isValid(String(subjectId))) {
      return next(new AppError('Invalid subjectId', 400));
    }

    const sem = Number(semesterNumber);
    if (!Number.isInteger(sem) || sem < 1) {
      return next(new AppError('Invalid semesterNumber', 400));
    }

    // Faculty filter:
    // - FACULTY users will ONLY see their own assignment entries.
    // - HOD/ADMIN can optionally pass facultyId to filter; otherwise they see all assignments for the subject.
    let facultyIdFilter = null;

    if (req.user.role === 'FACULTY') {
      const faculty = await Faculty.findOne({ userId: req.user._id })
        .select('_id')
        .lean();

      if (!faculty) {
        return next(new AppError('Faculty not found for this user', 404));
      }

      facultyIdFilter = faculty._id;
    } else if (rawFacultyId) {
      if (!mongoose.Types.ObjectId.isValid(String(rawFacultyId))) {
        return next(new AppError('Invalid facultyId', 400));
      }
      facultyIdFilter = rawFacultyId;
    }

    const timetable = await Timetable.findOne({
      sectionId,
      academicYearId,
      semesterNumber: sem
    }).lean();

    if (!timetable) {
      return res.status(200).json({
        success: true,
        data: {
          dateString: targetDateString,
          day: dayName,
          slots: [],
          entries: [],
          attendanceSheets: []
        }
      });
    }

    // Find all componentIds for this subject (THEORY/PRACTICAL/etc)
    const subjectComponents = await SubjectComponent.find({ subjectId })
      .select('_id')
      .lean();

    const subjectComponentIds = subjectComponents.map((sc) => sc._id);

    if (!subjectComponentIds.length) {
      return res.status(200).json({
        success: true,
        data: {
          dateString: targetDateString,
          day: dayName,
          slots: [],
          entries: [],
          attendanceSheets: []
        }
      });
    }

    const faQuery = {
      sectionId,
      academicYearId,
      semesterNumber: sem,
      status: 'active',
      subjectComponentId: { $in: subjectComponentIds }
    };

    if (facultyIdFilter) {
      faQuery.facultyIds = facultyIdFilter;
    }

    const assignments = await FacultyAssignment.find(faQuery)
      .select('_id subjectComponentId venue')
      .populate({
        path: 'subjectComponentId',
        select: 'name shortName componentType subjectId',
        populate: {
          path: 'subjectId',
          select: 'name code shortName'
        }
      })
      .lean();

    const assignmentIds = assignments.map((a) => a._id);
    const assignmentById = new Map(
      assignments.map((assignment) => [String(assignment._id), assignment])
    );

    if (!assignmentIds.length) {
      return res.status(200).json({
        success: true,
        data: {
          dateString: targetDateString,
          day: dayName,
          slots: [],
          entries: [],
          attendanceSheets: []
        }
      });
    }

    // Get timetable entries only for this subject (and faculty when filtered) on that day
    const entries = await TimetableEntry.find({
      timetableId: timetable._id,
      day: dayName,
      facultyAssignmentId: { $in: assignmentIds }
    })
      .sort({ slotOrder: 1 })
      .lean();

    if (!entries.length) {
      return res.status(200).json({
        success: true,
        data: {
          dateString: targetDateString,
          day: dayName,
          slots: [],
          entries: [],
          attendanceSheets: []
        }
      });
    }

    const slotOrders = new Set(entries.map((e) => e.slotOrder));

    const slots = (timetable.slots || [])
      .filter((s) => slotOrders.has(s.order))
      .sort((a, b) => a.order - b.order);

    const entryIds = entries.map((e) => e._id);

    const attendanceQuery = {
      timetableEntry: { $in: entryIds },
      dateString: targetDateString
    };

    // When coming from a classroom click, keep sheets scoped to that classroom.
    if (resolvedClassroomId) {
      attendanceQuery.classroom = resolvedClassroomId;
    }

    const attendanceSheets = await Attendance.find(attendanceQuery)
      .select('_id timetableEntry status isLocked markedAt')
      .lean();

    const latestRequestByAttendance = new Map();
    const attendanceIds = attendanceSheets.map((sheet) => sheet._id);

    if (attendanceIds.length) {
      const requests = await AttendanceRequest.find({
        attendanceRecord: { $in: attendanceIds }
      })
        .sort({ createdAt: -1 })
        .lean();

      requests.forEach((request) => {
        const key = String(request.attendanceRecord);
        if (!latestRequestByAttendance.has(key)) {
          latestRequestByAttendance.set(key, request);
        }
      });
    }

    const attendanceByEntry = new Map(
      attendanceSheets.map((sheet) => [
        String(sheet.timetableEntry),
        {
          ...sheet,
          latestRequest:
            latestRequestByAttendance.get(String(sheet._id)) || null
        }
      ])
    );

    const slotByOrder = new Map(
      (timetable.slots || []).map((slot) => [Number(slot.order), slot])
    );

    const enrichedEntries = entries.map((entry) => {
      const assignment = assignmentById.get(String(entry.facultyAssignmentId));
      const component = assignment?.subjectComponentId;
      const subject = component?.subjectId;
      const slot = slotByOrder.get(Number(entry.slotOrder));
      const attendance = attendanceByEntry.get(String(entry._id)) || null;

      return {
        ...entry,
        facultyAssignmentId:
          assignment?._id || entry.facultyAssignmentId || null,
        label: buildPeriodLabel(entry.slotOrder, component),
        title: buildPeriodLabel(entry.slotOrder, component),
        startTime: slot?.startTime || null,
        endTime: slot?.endTime || null,
        type: slot?.type || 'class',
        componentName: component?.name || '',
        componentShortName: component?.shortName || '',
        componentType: component?.componentType || '',
        subjectComponent: toSubjectComponentPayload(component),
        subject: toSubjectPayload(subject),
        attendanceId: attendance?._id || null,
        attendanceStatus: attendance?.status || null,
        isLocked: attendance?.isLocked || false,
        markedAt: attendance?.markedAt || null,
        latestRequest: attendance?.latestRequest || null
      };
    });

    const decoratedAttendanceSheets = [...attendanceByEntry.values()];

    res.status(200).json({
      success: true,
      data: {
        dateString: targetDateString,
        day: dayName,
        slots,
        entries: enrichedEntries,
        attendanceSheets: decoratedAttendanceSheets
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
  const { facultyId, academicYearId } = req.query;

  if (!facultyId) {
    return next(new AppError('Faculty ID is required', 400));
  }

  let targetAcademicYearId = academicYearId;

  if (!targetAcademicYearId) {
    const currentAcademicYear = await AcademicYear.findOne({
      isActive: true
    }).lean();
    if (!currentAcademicYear)
      return next(new AppError('No active academic year found', 400));
    targetAcademicYearId = currentAcademicYear._id;
  }

  // 1. Find all active assignments for this faculty across ALL semesters
  const [facultyAssignments, additionalHours] = await Promise.all([
    FacultyAssignment.find({
      facultyIds: facultyId,
      academicYearId: targetAcademicYearId,
      status: 'active'
    })
      .select('_id sectionId subjectComponentId venue semesterNumber')
      .lean(),
    AdditionalHour.find({
      facultyIds: facultyId,
      academicYearId: targetAcademicYearId
    })
      .select('_id sectionId name shortName venue semesterNumber')
      .lean()
  ]);

  const faIds = facultyAssignments.map((fa) => fa._id);
  const ahIds = additionalHours.map((ah) => ah._id);

  // 2. Find all Timetable Entries for these assignments
  const entries = await TimetableEntry.find({
    $or: [
      { facultyAssignmentId: { $in: faIds } },
      { additionalHourId: { $in: ahIds } }
    ]
  }).lean();

  if (!entries.length) {
    return res
      .status(200)
      .json({ success: true, data: { slots: [], grid: {} } });
  }

  // 3. Fetch Slot structure (Assuming uniform slots across the institution)
  const timetableIds = [
    ...new Set(entries.map((e) => e.timetableId.toString()))
  ];
  const timetables = await Timetable.find({ _id: { $in: timetableIds } })
    .select('slots')
    .lean();
  const slots = timetables[0]?.slots.sort((a, b) => a.order - b.order) || [];

  // 4. Pre-fetch Metadata (Sections, Departments, Subjects)
  const sectionIds = [
    ...new Set([
      ...facultyAssignments.map((fa) => fa.sectionId.toString()),
      ...additionalHours.map((ah) => ah.sectionId.toString())
    ])
  ];

  const [sections, ayDoc] = await Promise.all([
    Section.find({ _id: { $in: sectionIds } })
      .populate({
        path: 'batchProgramId',
        populate: [
          { path: 'departmentId', select: 'name code' },
          { path: 'batchId', select: 'name' }
        ]
      })
      .lean(),
    AcademicYear.findById(targetAcademicYearId).select('name').lean()
  ]);

  const fasPopulated = await FacultyAssignment.find({ _id: { $in: faIds } })
    .populate({
      path: 'subjectComponentId',
      populate: { path: 'subjectId', select: 'name code shortName' }
    })
    .lean();

  const sectionMap = new Map(sections.map((s) => [s._id.toString(), s]));
  const faMap = new Map(fasPopulated.map((f) => [f._id.toString(), f]));
  const ahMap = new Map(additionalHours.map((a) => [a._id.toString(), a]));

  // 5. Build the Unified Grid
  const grid = {};

  entries.forEach((entry) => {
    const { day, slotOrder, facultyAssignmentId, additionalHourId } = entry;

    if (!grid[day]) grid[day] = {};
    if (!grid[day][slotOrder]) grid[day][slotOrder] = [];

    let entryData = {};

    if (facultyAssignmentId) {
      const fa = faMap.get(facultyAssignmentId.toString());
      const section = sectionMap.get(fa?.sectionId.toString());
      const subComp = fa?.subjectComponentId;

      entryData = {
        type: 'regular',
        semesterNumber: fa?.semesterNumber,
        batchName: section?.batchProgramId?.batchId?.name || '',
        departmentCode: section?.batchProgramId?.departmentId?.code || '',
        sectionName: section?.name || '',
        subjectCode: subComp?.subjectId?.code || '',
        subjectName: subComp?.subjectId?.name || '',
        subjectShortName:
          subComp?.shortName || subComp?.subjectId?.shortName || '',
        componentType: subComp?.componentType || '',
        venue: fa?.venue || ''
      };
    } else if (additionalHourId) {
      const ah = ahMap.get(additionalHourId.toString());
      const section = sectionMap.get(ah?.sectionId.toString());

      entryData = {
        type: 'additional',
        semesterNumber: ah?.semesterNumber,
        batchName: section?.batchProgramId?.batchId?.name || '',
        departmentCode: section?.batchProgramId?.departmentId?.code || '',
        sectionName: section?.name || '',
        subjectName: ah?.name || '',
        subjectShortName: ah?.shortName || '',
        venue: ah?.venue || ''
      };
    }

    grid[day][slotOrder].push(entryData);
  });

  res.status(200).json({
    success: true,
    data: {
      slots,
      grid,
      academicYear: ayDoc?.name,
      facultyId
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
          `Faculty is already assigned to a class on (${key.replace('_', ' ')} SLOT).`,
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
