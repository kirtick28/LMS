import mongoose from 'mongoose';
import AcademicCalendar from '../models/AcademicCalendar.js';
import AcademicYear from '../models/AcademicYear.js';
import Attendance from '../models/Attendance.js';
import AttendanceRequest from '../models/AttendanceRequest.js';
import Classroom from '../models/Classroom.js';
import Faculty from '../models/Faculty.js';
import FacultyAssignment from '../models/FacultyAssignment.js';
import Student from '../models/Student.js';
import Timetable from '../models/Timetable.js';
import TimetableEntry from '../models/TimetableEntry.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

const normalizeStudentStatus = (value) => {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  if (v === 'present') return 'Present';
  if (v === 'absent') return 'Absent';
  if (v === 'onduty' || v === 'on_duty' || v === 'on duty') return 'OnDuty';
  return null;
};

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const getTodayDateString = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

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

export const markAttendance = catchAsync(async (req, res, next) => {
  const { timetableEntryId, classroomId, dateString, students } = req.body;

  if (!timetableEntryId || !classroomId || !dateString || !students) {
    return next(
      new AppError(
        'Please provide timetableEntryId, classroomId, dateString, and students list',
        400
      )
    );
  }

  if (!mongoose.Types.ObjectId.isValid(timetableEntryId)) {
    return next(new AppError('Invalid timetableEntryId', 400));
  }

  if (!mongoose.Types.ObjectId.isValid(classroomId)) {
    return next(new AppError('Invalid classroomId', 400));
  }

  if (!Array.isArray(students) || students.length === 0) {
    return next(new AppError('students must be a non-empty array', 400));
  }

  const normalizedDateString = String(dateString);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateString)) {
    return next(new AppError('Invalid dateString format (YYYY-MM-DD)', 400));
  }

  const normalizedDate = new Date(`${normalizedDateString}T00:00:00.000Z`);
  if (Number.isNaN(normalizedDate.getTime())) {
    return next(new AppError('Invalid dateString', 400));
  }

  if (
    req.user.role === 'FACULTY' &&
    normalizedDateString !== getTodayDateString()
  ) {
    return next(
      new AppError(
        'Faculty can mark attendance only for the current day. Submit a change request for locked or past attendance.',
        403
      )
    );
  }

  // Holiday check (only when explicitly configured)
  const calendarEntry = await AcademicCalendar.findOne({
    dateString: normalizedDateString
  })
    .select('isWorkingDay')
    .lean();

  if (calendarEntry && !calendarEntry.isWorkingDay) {
    return next(new AppError('Attendance cannot be marked on a holiday', 400));
  }

  const classroom = await Classroom.findById(classroomId)
    .select(
      'sectionId subjectId academicYearId semesterNumber status isDeleted'
    )
    .lean();

  if (!classroom || classroom.isDeleted || classroom.status !== 'active') {
    return next(new AppError('Classroom not found', 404));
  }

  const entry = await TimetableEntry.findById(timetableEntryId)
    .populate('timetableId')
    .lean();

  if (!entry) {
    return next(new AppError('Timetable entry not found', 404));
  }

  // Validate the day of the week matches the timetable entry
  const daysMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayName = daysMap[normalizedDate.getUTCDay()];

  if (dayName !== entry.day) {
    return next(
      new AppError(
        `Invalid day. This timetable entry is for ${entry.day}, but the provided date is a ${dayName}.`,
        400
      )
    );
  }

  // Academic year must be active
  const academicYear = await AcademicYear.findById(
    entry.timetableId.academicYearId
  )
    .select('isActive')
    .lean();

  if (!academicYear || !academicYear.isActive) {
    return next(
      new AppError(
        'Attendance cannot be marked for an inactive academic year',
        400
      )
    );
  }

  // Resolve current faculty (User -> Faculty)
  const markerFaculty = await Faculty.findOne({ userId: req.user._id })
    .select('_id')
    .lean();

  if (!markerFaculty) {
    return next(new AppError('Faculty not found for this user', 404));
  }

  // Validate the timetable entry belongs to the same timetable context as the classroom
  if (
    String(entry.timetableId.sectionId) !== String(classroom.sectionId) ||
    String(entry.timetableId.academicYearId) !==
      String(classroom.academicYearId) ||
    Number(entry.timetableId.semesterNumber) !==
      Number(classroom.semesterNumber)
  ) {
    return next(
      new AppError(
        'Timetable entry does not belong to this classroom context',
        400
      )
    );
  }

  // Validate faculty assignment matches classroom subject and the logged-in faculty
  if (!entry.facultyAssignmentId) {
    return next(
      new AppError(
        'This timetable entry is not linked to a faculty assignment',
        400
      )
    );
  }

  const fa = await FacultyAssignment.findById(entry.facultyAssignmentId)
    .select(
      '_id facultyIds sectionId academicYearId semesterNumber subjectComponentId status'
    )
    .populate({
      path: 'subjectComponentId',
      select: 'name shortName componentType subjectId',
      populate: {
        path: 'subjectId',
        select: 'name code shortName'
      }
    })
    .lean();

  if (!fa || fa.status !== 'active') {
    return next(
      new AppError('Faculty assignment not found/active for this entry', 404)
    );
  }

  const faSubjectId =
    fa.subjectComponentId?.subjectId?._id || fa.subjectComponentId?.subjectId;

  if (
    String(fa.sectionId) !== String(classroom.sectionId) ||
    String(fa.academicYearId) !== String(classroom.academicYearId) ||
    Number(fa.semesterNumber) !== Number(classroom.semesterNumber) ||
    String(faSubjectId) !== String(classroom.subjectId)
  ) {
    return next(
      new AppError('Faculty assignment does not match this classroom', 400)
    );
  }

  // FACULTY can mark only their own assignment; HOD can mark any.
  const isMarkerInAssignment = (fa.facultyIds || []).some(
    (id) => String(id) === String(markerFaculty._id)
  );

  if (req.user.role === 'FACULTY' && !isMarkerInAssignment) {
    return next(
      new AppError('You are not assigned to this timetable entry', 403)
    );
  }

  // Validate students belong to the classroom section
  const incomingStudentIds = students.map((s) =>
    String(s.studentId || s.student)
  );

  const uniqueStudentIds = [...new Set(incomingStudentIds)].filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );

  if (uniqueStudentIds.length !== incomingStudentIds.length) {
    return next(
      new AppError('students contains invalid or duplicate studentId', 400)
    );
  }

  const studentCount = await Student.countDocuments({
    _id: { $in: uniqueStudentIds },
    sectionId: classroom.sectionId,
    status: 'active'
  });

  if (studentCount !== uniqueStudentIds.length) {
    return next(
      new AppError('One or more students do not belong to this section', 400)
    );
  }

  const records = students.map((s) => {
    const student = s.studentId || s.student;
    const status = normalizeStudentStatus(s.status);
    if (!status) {
      throw new AppError('Invalid student status (Present/Absent/OnDuty)', 400);
    }
    return {
      student,
      status,
      remarks: s.remarks
    };
  });

  const existing = await Attendance.findOne({
    classroom: classroomId,
    timetableEntry: timetableEntryId,
    dateString: normalizedDateString
  });

  if (existing) {
    if (req.user.role !== 'HOD') {
      return next(
        new AppError(
          'Attendance already marked and locked for this period. Submit a change request to HOD.',
          409
        )
      );
    }

    existing.records = records;
    existing.markedAt = new Date();
    existing.status = 'UPDATED_BY_HOD';

    await existing.save();

    return res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: { attendanceId: existing._id }
    });
  }

  const slot = (entry.timetableId?.slots || []).find(
    (s) => Number(s.order) === Number(entry.slotOrder)
  );

  try {
    const created = await Attendance.create({
      classroom: classroomId,
      timetableEntry: timetableEntryId,
      faculty: markerFaculty._id,
      subject: faSubjectId,
      subjectComponent: fa.subjectComponentId?._id,
      slotOrder: entry.slotOrder,
      day: entry.day,
      periodStartTime: slot?.startTime || null,
      periodEndTime: slot?.endTime || null,
      date: normalizedDate,
      dateString: normalizedDateString,
      records,
      status: 'MARKED',
      isLocked: true
    });

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: { attendanceId: created._id }
    });
  } catch (err) {
    // Unique index collision (duplicate create) safety
    if (err && err.code === 11000) {
      return next(
        new AppError('Attendance already marked for this period and date', 409)
      );
    }
    throw err;
  }
});

export const requestAttendanceChange = catchAsync(async (req, res, next) => {
  const { attendanceId, requestedChanges, reason } = req.body;
  const trimmedReason = String(reason || '').trim();

  if (!attendanceId || !requestedChanges || !trimmedReason) {
    return next(
      new AppError(
        'attendanceId, requestedChanges, and reason are required',
        400
      )
    );
  }

  if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
    return next(new AppError('Invalid attendanceId', 400));
  }

  if (!Array.isArray(requestedChanges) || requestedChanges.length === 0) {
    return next(
      new AppError('requestedChanges must be a non-empty array', 400)
    );
  }

  const faculty = await Faculty.findOne({ userId: req.user._id })
    .select('_id')
    .lean();

  if (!faculty) {
    return next(new AppError('Faculty not found for this user', 404));
  }

  const attendance = await Attendance.findById(attendanceId).lean();
  if (!attendance) {
    return next(new AppError('Attendance record not found', 404));
  }

  // Only the faculty who marked it can request changes
  if (String(attendance.faculty) !== String(faculty._id)) {
    return next(
      new AppError('You can request changes only for your own attendance', 403)
    );
  }

  const existingPending = await AttendanceRequest.findOne({
    attendanceRecord: attendanceId,
    faculty: faculty._id,
    approvalStatus: 'Pending'
  })
    .select('_id')
    .lean();

  if (existingPending) {
    return next(
      new AppError('A pending request already exists for this attendance', 409)
    );
  }

  const recordMap = new Map(
    (attendance.records || []).map((r) => [String(r.student), r.status])
  );

  const changedStudentIds = new Set();

  const normalizedChanges = requestedChanges.map((c) => {
    const studentId = c.studentId || c.student;
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      throw new AppError('Invalid studentId in requestedChanges', 400);
    }

    if (changedStudentIds.has(String(studentId))) {
      throw new AppError('Duplicate student in requestedChanges', 400);
    }
    changedStudentIds.add(String(studentId));

    const prev = recordMap.get(String(studentId));
    if (!prev) {
      throw new AppError(
        'Requested student not found in attendance records',
        400
      );
    }

    const nextStatus = normalizeStudentStatus(c.newStatus || c.status);
    if (!nextStatus) {
      throw new AppError('Invalid newStatus in requestedChanges', 400);
    }

    if (prev === nextStatus) {
      throw new AppError('newStatus must differ from previousStatus', 400);
    }

    return {
      student: studentId,
      previousStatus: prev,
      newStatus: nextStatus
    };
  });

  const request = await AttendanceRequest.create({
    attendanceRecord: attendanceId,
    faculty: faculty._id,
    requestedChanges: normalizedChanges,
    reason: trimmedReason,
    approvalStatus: 'Pending'
  });

  res.status(201).json({
    success: true,
    message: 'Change request submitted to HOD',
    data: { requestId: request._id }
  });
});

export const resolveAttendanceRequest = catchAsync(async (req, res, next) => {
  const { requestId, status, reviewRemarks } = req.body;
  const resolutionStatus = String(status || '');

  if (!requestId || !status) {
    return next(new AppError('requestId and status are required', 400));
  }

  if (!['Approved', 'Rejected'].includes(resolutionStatus)) {
    return next(new AppError('status must be Approved or Rejected', 400));
  }

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return next(new AppError('Invalid requestId', 400));
  }

  const reviewer = await Faculty.findOne({ userId: req.user._id })
    .select('_id departmentId')
    .lean();

  if (!reviewer) {
    return next(new AppError('Faculty not found for this user', 404));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const request =
      await AttendanceRequest.findById(requestId).session(session);

    if (!request || request.approvalStatus !== 'Pending') {
      throw new AppError('Request not found or already resolved', 404);
    }

    const requester = await Faculty.findById(request.faculty)
      .select('departmentId')
      .session(session)
      .lean();

    if (
      !requester ||
      String(requester.departmentId) !== String(reviewer.departmentId)
    ) {
      throw new AppError('You can resolve only your department requests', 403);
    }

    request.approvalStatus = resolutionStatus;
    request.reviewedBy = reviewer._id;
    request.reviewRemarks = reviewRemarks
      ? String(reviewRemarks).trim()
      : undefined;
    request.resolvedAt = new Date();

    if (resolutionStatus === 'Approved') {
      const attendance = await Attendance.findById(
        request.attendanceRecord
      ).session(session);

      if (!attendance) {
        throw new AppError('Attendance record not found for this request', 404);
      }

      const recordIndexByStudent = new Map(
        attendance.records.map((r, idx) => [String(r.student), idx])
      );

      request.requestedChanges.forEach((change) => {
        const idx = recordIndexByStudent.get(String(change.student));
        if (idx === undefined) {
          throw new AppError('Student not found in attendance records', 400);
        }
        if (attendance.records[idx].status !== change.previousStatus) {
          throw new AppError(
            'Attendance has changed after this request was raised. Ask the faculty to refresh and submit again.',
            409
          );
        }
        attendance.records[idx].status = change.newStatus;
      });

      attendance.status = 'UPDATED_BY_HOD';
      await attendance.save({ session });
    }

    await request.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Request ${resolutionStatus}`
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

export const getAttendanceRequests = catchAsync(async (req, res, next) => {
  const { status = 'Pending' } = req.query;
  const allowedStatuses = ['Pending', 'Approved', 'Rejected', 'All'];
  const normalizedStatus = String(status);

  if (!allowedStatuses.includes(normalizedStatus)) {
    return next(
      new AppError('status must be Pending, Approved, Rejected, or All', 400)
    );
  }

  const reviewer = await Faculty.findOne({ userId: req.user._id })
    .select('_id departmentId')
    .lean();

  if (!reviewer) {
    return next(new AppError('Faculty not found for this user', 404));
  }

  const departmentFacultyIds = await Faculty.find({
    departmentId: reviewer.departmentId
  })
    .select('_id')
    .lean();

  const filter = {
    faculty: { $in: departmentFacultyIds.map((f) => f._id) }
  };

  if (normalizedStatus !== 'All') {
    filter.approvalStatus = normalizedStatus;
  }

  const requests = await AttendanceRequest.find(filter)
    .sort({ approvalStatus: 1, createdAt: -1 })
    .populate({
      path: 'faculty',
      select: 'salutation firstName lastName employeeId departmentId'
    })
    .populate({
      path: 'reviewedBy',
      select: 'salutation firstName lastName employeeId'
    })
    .populate({
      path: 'requestedChanges.student',
      select: 'firstName lastName registerNumber rollNumber'
    })
    .populate({
      path: 'attendanceRecord',
      populate: [
        {
          path: 'classroom',
          select: 'sectionId subjectId academicYearId semesterNumber name',
          populate: [
            {
              path: 'sectionId',
              select: 'name batchProgramId'
            },
            {
              path: 'subjectId',
              select: 'name code shortName'
            },
            {
              path: 'academicYearId',
              select: 'name'
            }
          ]
        },
        {
          path: 'timetableEntry',
          select: 'day slotOrder facultyAssignmentId',
          populate: {
            path: 'facultyAssignmentId',
            select: 'subjectComponentId venue',
            populate: {
              path: 'subjectComponentId',
              select: 'name shortName componentType subjectId',
              populate: {
                path: 'subjectId',
                select: 'name code shortName'
              }
            }
          }
        },
        {
          path: 'subjectComponent',
          select: 'name shortName componentType subjectId',
          populate: {
            path: 'subjectId',
            select: 'name code shortName'
          }
        }
      ]
    })
    .lean();

  const counts = await AttendanceRequest.aggregate([
    {
      $match: {
        faculty: { $in: departmentFacultyIds.map((f) => f._id) }
      }
    },
    {
      $group: {
        _id: '$approvalStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  const summary = counts.reduce(
    (acc, item) => {
      acc[item._id] = item.count;
      acc.All += item.count;
      return acc;
    },
    { Pending: 0, Approved: 0, Rejected: 0, All: 0 }
  );

  res.status(200).json({
    success: true,
    data: {
      requests,
      summary
    }
  });
});

export const viewAttendance = catchAsync(async (req, res, next) => {
  const { classroomId, dateString, timetableEntryId } = req.query;

  if (!classroomId || !dateString) {
    return next(new AppError('classroomId and dateString are required', 400));
  }

  if (!mongoose.Types.ObjectId.isValid(classroomId)) {
    return next(new AppError('Invalid classroomId', 400));
  }

  if (
    timetableEntryId &&
    !mongoose.Types.ObjectId.isValid(String(timetableEntryId))
  ) {
    return next(new AppError('Invalid timetableEntryId', 400));
  }

  const ds = String(dateString);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) {
    return next(new AppError('Invalid dateString format (YYYY-MM-DD)', 400));
  }

  const parsedDate = new Date(`${ds}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return next(new AppError('Invalid dateString', 400));
  }

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayName = days[parsedDate.getUTCDay()];

  const classroom = await Classroom.findById(classroomId)
    .select(
      'sectionId subjectId academicYearId semesterNumber status isDeleted'
    )
    .lean();

  if (!classroom || classroom.isDeleted || classroom.status !== 'active') {
    return next(new AppError('Classroom not found', 404));
  }

  const timetable = await Timetable.findOne({
    sectionId: classroom.sectionId,
    academicYearId: classroom.academicYearId,
    semesterNumber: Number(classroom.semesterNumber)
  })
    .select('_id slots')
    .lean();

  // Always return student list, even if no timetable/periods (UI can still render)
  const students = await Student.find({
    sectionId: classroom.sectionId,
    status: 'active'
  })
    .select('_id firstName lastName registerNumber rollNumber')
    .sort({ rollNumber: 1, registerNumber: 1 })
    .lean();

  const calendarEntry = await AcademicCalendar.findOne({ dateString: ds })
    .select('isWorkingDay')
    .lean();

  if (calendarEntry && !calendarEntry.isWorkingDay) {
    return res.status(200).json({
      success: true,
      data: {
        dateString: ds,
        day: dayName,
        periods: [],
        slots: [],
        entries: [],
        students,
        attendances: []
      }
    });
  }

  if (!timetable) {
    return res.status(200).json({
      success: true,
      data: {
        dateString: ds,
        day: dayName,
        periods: [],
        slots: [],
        entries: [],
        students,
        attendances: []
      }
    });
  }

  // Fetch timetable entries for the day/classroom subject. If the UI passes a
  // timetableEntryId from getTimetableEntriesForAttendance, scope to that period.
  const entryQuery = {
    timetableId: timetable._id,
    day: dayName,
    facultyAssignmentId: { $ne: null }
  };

  if (timetableEntryId) {
    entryQuery._id = timetableEntryId;
  }

  const dayEntries = await TimetableEntry.find(entryQuery)
    .populate({
      path: 'facultyAssignmentId',
      select: 'facultyIds subjectComponentId status',
      populate: {
        path: 'subjectComponentId',
        select: 'name shortName componentType subjectId',
        populate: {
          path: 'subjectId',
          select: 'name code shortName'
        }
      }
    })
    .sort({ slotOrder: 1 })
    .lean();

  const filteredEntries = (dayEntries || []).filter((e) => {
    const fa = e.facultyAssignmentId;
    if (!fa || fa.status !== 'active') return false;

    const entrySubjectId =
      fa.subjectComponentId?.subjectId?._id ||
      fa.subjectComponentId?.subjectId;
    if (!entrySubjectId) return false;

    if (String(entrySubjectId) !== String(classroom.subjectId)) return false;

    return true;
  });

  if (!filteredEntries.length) {
    return res.status(200).json({
      success: true,
      data: {
        dateString: ds,
        day: dayName,
        periods: [],
        slots: [],
        entries: [],
        students,
        attendances: []
      }
    });
  }

  const slotByOrder = new Map(
    (timetable.slots || []).map((s) => [Number(s.order), s])
  );

  const entryIds = filteredEntries.map((e) => e._id);

  const attendances = await Attendance.find({
    classroom: classroomId,
    dateString: ds,
    timetableEntry: { $in: entryIds }
  })
    .populate({
      path: 'timetableEntry',
      select: 'day slotOrder facultyAssignmentId'
    })
    .populate({
      path: 'records.student',
      select: 'firstName lastName rollNumber registerNumber'
    })
    .lean();

  const attendanceIds = attendances.map((a) => a._id);
  let latestRequestByAttendance = new Map();

  if (attendanceIds.length) {
    const requestQuery = {
      attendanceRecord: { $in: attendanceIds }
    };

    if (req.user.role === 'FACULTY') {
      const faculty = await Faculty.findOne({ userId: req.user._id })
        .select('_id')
        .lean();
      if (faculty) requestQuery.faculty = faculty._id;
    }

    const requests = await AttendanceRequest.find(requestQuery)
      .sort({ createdAt: -1 })
      .lean();

    latestRequestByAttendance = new Map();
    requests.forEach((request) => {
      const key = String(request.attendanceRecord);
      if (!latestRequestByAttendance.has(key)) {
        latestRequestByAttendance.set(key, request);
      }
    });
  }

  const decoratedAttendances = attendances.map((attendance) => ({
    ...attendance,
    latestRequest:
      latestRequestByAttendance.get(String(attendance._id)) || null
  }));

  const attendanceByEntry = new Map(
    (decoratedAttendances || []).map((a) => [
      String(a.timetableEntry?._id || a.timetableEntry),
      a
    ])
  );

  const periods = filteredEntries.map((e) => {
    const slot = slotByOrder.get(Number(e.slotOrder));
    const attendance = attendanceByEntry.get(String(e._id)) || null;
    const component = e.facultyAssignmentId?.subjectComponentId;
    const subject = component?.subjectId;

    return {
      timetableEntryId: e._id,
      slotOrder: e.slotOrder,
      label: buildPeriodLabel(e.slotOrder, component),
      day: dayName,
      title: buildPeriodLabel(e.slotOrder, component),
      startTime: slot?.startTime || null,
      endTime: slot?.endTime || null,
      type: slot?.type || 'class',
      componentName: component?.name || '',
      componentShortName: component?.shortName || '',
      componentType: component?.componentType || '',
      subjectComponent: toSubjectComponentPayload(component),
      subject: toSubjectPayload(subject),
      attendance
    };
  });

  const slots = periods.map((p) => ({
    order: p.slotOrder,
    startTime: p.startTime,
    endTime: p.endTime,
    type: p.type
  }));

  const entries = filteredEntries.map((e) => ({
    _id: e._id,
    day: e.day,
    slotOrder: e.slotOrder,
    facultyAssignmentId: e.facultyAssignmentId?._id || e.facultyAssignmentId,
    componentName: e.facultyAssignmentId?.subjectComponentId?.name || '',
    componentShortName:
      e.facultyAssignmentId?.subjectComponentId?.shortName || '',
    componentType:
      e.facultyAssignmentId?.subjectComponentId?.componentType || '',
    subjectComponent: toSubjectComponentPayload(
      e.facultyAssignmentId?.subjectComponentId
    ),
    subject: toSubjectPayload(
      e.facultyAssignmentId?.subjectComponentId?.subjectId
    )
  }));

  res.status(200).json({
    success: true,
    data: {
      dateString: ds,
      day: dayName,
      periods,
      slots,
      entries,
      students,
      attendances: decoratedAttendances
    }
  });
});
