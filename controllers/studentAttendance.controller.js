import AcademicCalendar from '../models/AcademicCalendar.js';
import Classroom from '../models/Classroom.js';
import Attendance from '../models/Attendance.js';
import Timetable from '../models/Timetable.js';
import TimetableEntry from '../models/TimetableEntry.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import {
  getStudentAcademicContext,
  resolveAcademicYear
} from '../utils/classroomAccess.js';

const statusKeyMap = {
  Present: 'presentCount',
  Absent: 'absentCount',
  OnDuty: 'onDutyCount'
};

const colorTokens = ['blue', 'orange', 'pink', 'green', 'violet', 'red'];
const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const pad = (value) => String(value).padStart(2, '0');

const formatDateString = (date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;

const parseMonthDateInput = ({ month, date }) => {
  if (month && !/^\d{4}-\d{2}$/.test(String(month))) {
    throw new AppError('Invalid month format. Use YYYY-MM', 400);
  }

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    throw new AppError('Invalid date format. Use YYYY-MM-DD', 400);
  }

  const monthBase = month
    ? new Date(`${month}-01T00:00:00.000Z`)
    : date
      ? new Date(`${date}T00:00:00.000Z`)
      : new Date();

  if (Number.isNaN(monthBase.getTime())) {
    throw new AppError('Invalid month or date value', 400);
  }

  const year = monthBase.getUTCFullYear();
  const monthIndex = monthBase.getUTCMonth();
  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
  const startDateString = formatDateString(startDate);
  const endDateString = formatDateString(endDate);

  let selectedDateString = date || formatDateString(monthBase);
  if (
    selectedDateString < startDateString ||
    selectedDateString > endDateString
  ) {
    selectedDateString = startDateString;
  }

  return {
    year,
    month: monthIndex + 1,
    startDateString,
    endDateString,
    selectedDateString
  };
};

const formatAttendanceStatus = (status) => {
  if (status === 'OnDuty') return 'On Duty';
  return status;
};

const formatDisplayTime = (startTime, endTime) => {
  if (!startTime || !endTime) return 'Time not available';

  const toDisplay = (timeValue) => {
    const [hoursString = '0', minutesString = '00'] = String(timeValue).split(
      ':'
    );
    const hours = Number(hoursString);
    const minutes = Number(minutesString);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return timeValue;
    }

    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${pad(displayHour)}:${pad(minutes)}${suffix}`;
  };

  return `${toDisplay(startTime)}-${toDisplay(endTime)}`;
};

const buildDefaultCalendarMap = (year, monthNumber) => {
  const lastDate = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const calendarMap = {};

  for (let day = 1; day <= lastDate; day += 1) {
    const currentDate = new Date(Date.UTC(year, monthNumber - 1, day));
    const dateString = formatDateString(currentDate);
    const dayCode = days[currentDate.getUTCDay()];
    const isWorkingDay = dayCode !== 'SUN';

    calendarMap[dateString] = {
      dateString,
      isWorkingDay,
      dayType: isWorkingDay ? 'WORKING_DAY' : 'HOLIDAY',
      reasonForHoliday: isWorkingDay ? '' : 'Weekend'
    };
  }

  return calendarMap;
};

const buildCountsSummary = (monthlySummary) =>
  monthlySummary.reduce((accumulator, item) => {
    const dateKey = item._id.dateString;
    const statusKey = statusKeyMap[item._id.status];

    if (!accumulator[dateKey]) {
      accumulator[dateKey] = {
        presentCount: 0,
        absentCount: 0,
        onDutyCount: 0,
        totalCount: 0
      };
    }

    if (statusKey) {
      accumulator[dateKey][statusKey] = item.count;
      accumulator[dateKey].totalCount += item.count;
    }

    return accumulator;
  }, {});

const mergeCalendarWithSummary = (calendarMap, summaryByDate) =>
  Object.entries(calendarMap).reduce((accumulator, [dateString, dayInfo]) => {
    accumulator[dateString] = {
      ...dayInfo,
      presentCount: summaryByDate[dateString]?.presentCount || 0,
      absentCount: summaryByDate[dateString]?.absentCount || 0,
      onDutyCount: summaryByDate[dateString]?.onDutyCount || 0,
      totalCount: summaryByDate[dateString]?.totalCount || 0
    };
    return accumulator;
  }, {});

const getStudentRecord = (attendance, studentId) =>
  (attendance?.records || []).find(
    (record) => String(record.student) === String(studentId)
  );

const buildAttendanceTimeline = ({ attendances, studentId, currentSemesterNumber }) =>
  attendances.map((attendance, index) => {
    const studentRecord = getStudentRecord(attendance, studentId);

    return {
      _id: attendance._id,
      classroomId: attendance.classroom?._id || null,
      classroomSubject: attendance.classroom?.subjectId?.name || 'Class',
      classroomSubjectCode: attendance.classroom?.subjectId?.code || '',
      sectionName: attendance.classroom?.sectionId?.name || '',
      semesterNumber: attendance.classroom?.semesterNumber || currentSemesterNumber,
      facultyName: attendance.faculty
        ? `${attendance.faculty.firstName || ''} ${
            attendance.faculty.lastName || ''
          }`.trim()
        : 'Faculty',
      facultyDesignation: attendance.faculty?.designation || '',
      status: formatAttendanceStatus(studentRecord?.status || 'Absent'),
      rawStatus: studentRecord?.status || 'Absent',
      remarks: studentRecord?.remarks || '',
      slotOrder: attendance.slotOrder || index + 1,
      displayTime: formatDisplayTime(
        attendance.periodStartTime,
        attendance.periodEndTime
      ),
      colorToken: colorTokens[index % colorTokens.length]
    };
  });

const buildDaySchedule = async ({
  academicYearId,
  sectionId,
  semesterNumber,
  selectedDateString,
  studentId,
  classroomMapBySubjectId
}) => {
  const targetDate = new Date(`${selectedDateString}T00:00:00.000Z`);
  const dayCode = days[targetDate.getUTCDay()];
  const calendarEntry = await AcademicCalendar.findOne({
    dateString: selectedDateString
  })
    .select('dateString isWorkingDay reasonForHoliday')
    .lean();

  const calendarStatus = {
    dateString: selectedDateString,
    day: dayCode,
    isWorkingDay: calendarEntry ? calendarEntry.isWorkingDay : dayCode !== 'SUN',
    dayType:
      calendarEntry && !calendarEntry.isWorkingDay
        ? 'HOLIDAY'
        : dayCode === 'SUN'
          ? 'HOLIDAY'
          : 'WORKING_DAY',
    reasonForHoliday:
      calendarEntry?.reasonForHoliday || (dayCode === 'SUN' ? 'Weekend' : '')
  };

  const timetable = await Timetable.findOne({
    academicYearId,
    sectionId,
    semesterNumber
  }).lean();

  if (!timetable) {
    return {
      calendarStatus,
      slots: [],
      schedule: []
    };
  }

  const baseSlots = [...(timetable.slots || [])].sort((a, b) => a.order - b.order);

  if (dayCode === 'SUN' || !calendarStatus.isWorkingDay) {
    return {
      calendarStatus,
      slots: baseSlots.map((slot) => ({
        slotOrder: slot.order,
        type: slot.type || 'class',
        startTime: slot.startTime || '',
        endTime: slot.endTime || '',
        displayTime: formatDisplayTime(slot.startTime, slot.endTime)
      })),
      schedule: []
    };
  }

  const entries = await TimetableEntry.find({
    timetableId: timetable._id,
    day: dayCode
  })
    .populate({
      path: 'facultyAssignmentId',
      select: 'facultyIds subjectComponentId venue',
      populate: [
        {
          path: 'facultyIds',
          select: 'firstName lastName designation'
        },
        {
          path: 'subjectComponentId',
          select: 'name shortName componentType subjectId',
          populate: {
            path: 'subjectId',
            select: 'name code shortName'
          }
        }
      ]
    })
    .sort({ slotOrder: 1 })
    .lean();

  const attendanceRecords = await Attendance.find({
    dateString: selectedDateString,
    timetableEntry: { $in: entries.map((entry) => entry._id) }
  })
    .select(
      '_id classroom timetableEntry slotOrder periodStartTime periodEndTime records status isLocked'
    )
    .lean();

  const attendanceByEntryId = new Map(
    attendanceRecords.map((attendance) => [String(attendance.timetableEntry), attendance])
  );

  const entryBySlotOrder = new Map(
    entries.map((entry) => [Number(entry.slotOrder), entry])
  );

  const schedule = baseSlots.map((slot, index) => {
    const timetableEntry = entryBySlotOrder.get(Number(slot.order));

    if (!timetableEntry) {
      return {
        slotOrder: slot.order,
        type: slot.type || 'class',
        displayTime: formatDisplayTime(slot.startTime, slot.endTime),
        startTime: slot.startTime || '',
        endTime: slot.endTime || '',
        title:
          slot.type === 'break'
            ? 'Break'
            : slot.type === 'lunch'
              ? 'Lunch'
              : 'Free Hour',
        subjectName: '',
        subjectCode: '',
        subjectShortName: '',
        componentName: '',
        componentType: '',
        facultyName: '',
        facultyDesignation: '',
        venue: '',
        classroomId: null,
        attendanceId: null,
        attendanceLabel: '',
        attendanceStatus: null,
        remarks: '',
        isLocked: false,
        colorToken: colorTokens[index % colorTokens.length]
      };
    }

    const assignment = timetableEntry.facultyAssignmentId;
    const component = assignment?.subjectComponentId;
    const subject = component?.subjectId;
    const attendance = attendanceByEntryId.get(String(timetableEntry._id));
    const studentRecord = getStudentRecord(attendance, studentId);
    const faculty = Array.isArray(assignment?.facultyIds)
      ? assignment.facultyIds[0]
      : null;
    const linkedClassroom = subject?._id
      ? classroomMapBySubjectId.get(String(subject._id))
      : null;

    return {
      slotOrder: slot.order,
      type: slot.type || 'class',
      displayTime: formatDisplayTime(slot.startTime, slot.endTime),
      startTime:
        attendance?.periodStartTime || slot.startTime || '',
      endTime: attendance?.periodEndTime || slot.endTime || '',
      title:
        subject?.name ||
        component?.shortName ||
        component?.name ||
        `Period ${slot.order}`,
      subjectName: subject?.name || '',
      subjectCode: subject?.code || '',
      subjectShortName: subject?.shortName || '',
      componentName: component?.name || '',
      componentType: component?.componentType || '',
      facultyName: faculty
        ? `${faculty.firstName || ''} ${faculty.lastName || ''}`.trim()
        : '',
      facultyDesignation: faculty?.designation || '',
      venue: assignment?.venue || '',
      classroomId: linkedClassroom?._id || null,
      attendanceId: attendance?._id || null,
      attendanceLabel: studentRecord?.status
        ? formatAttendanceStatus(studentRecord.status)
        : '',
      attendanceStatus: studentRecord?.status || null,
      remarks: studentRecord?.remarks || '',
      isLocked: attendance?.isLocked || false,
      colorToken: colorTokens[index % colorTokens.length]
    };
  });

  return {
    calendarStatus,
    slots: baseSlots.map((slot) => ({
      slotOrder: slot.order,
      type: slot.type || 'class',
      startTime: slot.startTime || '',
      endTime: slot.endTime || '',
      displayTime: formatDisplayTime(slot.startTime, slot.endTime)
    })),
    schedule
  };
};

export const getMyAttendanceOverview = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'STUDENT') {
    return next(new AppError('Only students can access attendance overview', 403));
  }

  const { month, date } = req.query;
  const {
    year,
    month: monthNumber,
    startDateString,
    endDateString,
    selectedDateString
  } = parseMonthDateInput({
    month,
    date
  });

  const academicYear = await resolveAcademicYear();
  const { student, academicRecord } = await getStudentAcademicContext(
    req.user._id,
    academicYear._id
  );

  const currentSectionId = academicRecord?.sectionId || student.sectionId;
  const currentSemesterNumber =
    academicRecord?.semesterNumber || student.semesterNumber;

  const classrooms = await Classroom.find({
    academicYearId: academicYear._id,
    sectionId: currentSectionId,
    semesterNumber: currentSemesterNumber,
    status: 'active',
    isDeleted: false
  })
    .select('_id subjectId sectionId semesterNumber')
    .populate({
      path: 'subjectId',
      select: 'name code shortName'
    })
    .populate({
      path: 'sectionId',
      select: 'name'
    })
    .sort({ createdAt: -1 })
    .lean();

  const classroomIds = classrooms.map((classroom) => classroom._id);
  const classroomMapBySubjectId = new Map(
    classrooms
      .filter((classroom) => classroom.subjectId?._id)
      .map((classroom) => [String(classroom.subjectId._id), classroom])
  );

  const calendarEntries = await AcademicCalendar.find({
    dateString: {
      $gte: startDateString,
      $lte: endDateString
    }
  })
    .select('dateString isWorkingDay reasonForHoliday')
    .lean();

  const calendarMap = buildDefaultCalendarMap(year, monthNumber);
  calendarEntries.forEach((entry) => {
    calendarMap[entry.dateString] = {
      dateString: entry.dateString,
      isWorkingDay: entry.isWorkingDay,
      dayType: entry.isWorkingDay ? 'WORKING_DAY' : 'HOLIDAY',
      reasonForHoliday: entry.isWorkingDay ? '' : entry.reasonForHoliday || ''
    };
  });

  let summaryByDate = {};
  let timeline = [];

  if (classroomIds.length) {
    const monthlySummary = await Attendance.aggregate([
      {
        $match: {
          classroom: { $in: classroomIds },
          dateString: {
            $gte: startDateString,
            $lte: endDateString
          }
        }
      },
      { $unwind: '$records' },
      {
        $match: {
          'records.student': student._id
        }
      },
      {
        $group: {
          _id: {
            dateString: '$dateString',
            status: '$records.status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          '_id.dateString': 1
        }
      }
    ]);

    summaryByDate = buildCountsSummary(monthlySummary);

    const dayAttendances = await Attendance.find({
      classroom: { $in: classroomIds },
      dateString: selectedDateString,
      'records.student': student._id
    })
      .select(
        'classroom faculty slotOrder periodStartTime periodEndTime dateString records'
      )
      .populate({
        path: 'classroom',
        select: 'subjectId sectionId semesterNumber',
        populate: [
          {
            path: 'subjectId',
            select: 'name code shortName'
          },
          {
            path: 'sectionId',
            select: 'name'
          }
        ]
      })
      .populate({
        path: 'faculty',
        select: 'firstName lastName designation'
      })
      .sort({ slotOrder: 1, periodStartTime: 1 })
      .lean();

    timeline = buildAttendanceTimeline({
      attendances: dayAttendances,
      studentId: student._id,
      currentSemesterNumber
    });
  }

  const calendarWithSummary = mergeCalendarWithSummary(calendarMap, summaryByDate);
  const dayView = await buildDaySchedule({
    academicYearId: academicYear._id,
    sectionId: currentSectionId,
    semesterNumber: currentSemesterNumber,
    selectedDateString,
    studentId: student._id,
    classroomMapBySubjectId
  });

  res.status(200).json({
    success: true,
    data: {
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        registerNumber: student.registerNumber,
        rollNumber: student.rollNumber
      },
      month: {
        year,
        month: monthNumber
      },
      selectedDate: selectedDateString,
      academicYear: {
        _id: academicYear._id,
        name: academicYear.name
      },
      classrooms: classrooms.map((classroom) => ({
        _id: classroom._id,
        subject: classroom.subjectId
          ? {
              _id: classroom.subjectId._id,
              name: classroom.subjectId.name,
              code: classroom.subjectId.code,
              shortName: classroom.subjectId.shortName
            }
          : null,
        section: classroom.sectionId
          ? {
              _id: classroom.sectionId._id,
              name: classroom.sectionId.name
            }
          : null,
        semesterNumber: classroom.semesterNumber
      })),
      summaryByDate,
      calendarByDate: calendarWithSummary,
      dayView,
      timeline
    }
  });
});
