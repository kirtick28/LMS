import AcademicCalendar from '../models/AcademicCalendar.js';
import Attendance from '../models/Attendance.js';
import Classroom from '../models/Classroom.js';
import Student from '../models/Student.js';
import StudentAcademicRecord from '../models/StudentAcademicRecord.js';
import Timetable from '../models/Timetable.js';
import TimetableEntry from '../models/TimetableEntry.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import {
  getStudentAcademicContext,
  resolveAcademicYear
} from '../utils/classroomAccess.js';

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const pad = (value) => String(value).padStart(2, '0');

const formatDateString = (date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;

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

const getStudentRecord = (attendance, studentId) =>
  (attendance?.records || []).find(
    (record) => String(record.student) === String(studentId)
  );

const computeOverallAttendancePercentage = async ({
  classroomIds,
  studentId
}) => {
  if (!classroomIds.length) {
    return 0;
  }

  const attendanceSheets = await Attendance.find({
    classroom: { $in: classroomIds },
    'records.student': studentId
  })
    .select('records')
    .lean();

  if (!attendanceSheets.length) {
    return 0;
  }

  let presentCount = 0;
  let totalCount = 0;

  attendanceSheets.forEach((attendance) => {
    const studentRecord = getStudentRecord(attendance, studentId);
    if (!studentRecord) {
      return;
    }

    totalCount += 1;
    if (
      studentRecord.status === 'Present' ||
      studentRecord.status === 'OnDuty'
    ) {
      presentCount += 1;
    }
  });

  if (!totalCount) {
    return 0;
  }

  return Math.round((presentCount / totalCount) * 100);
};

const getYearLabel = (semesterNumber) => {
  const yearLevel = Math.max(1, Math.ceil(Number(semesterNumber || 1) / 2));
  const suffixMap = {
    1: '1st year',
    2: '2nd year',
    3: '3rd year',
    4: '4th year'
  };

  return suffixMap[yearLevel] || `${yearLevel}th year`;
};

const getCalendarStatus = async (dateString) => {
  const targetDate = new Date(`${dateString}T00:00:00.000Z`);
  const dayCode = DAY_CODES[targetDate.getUTCDay()];

  const calendarEntry = await AcademicCalendar.findOne({ dateString })
    .select('isWorkingDay reasonForHoliday')
    .lean();

  const isWorkingDay = calendarEntry
    ? calendarEntry.isWorkingDay
    : dayCode !== 'SUN';

  return {
    dateString,
    dayCode,
    isWorkingDay,
    reasonForHoliday:
      calendarEntry?.reasonForHoliday || (dayCode === 'SUN' ? 'Weekend' : '')
  };
};

const buildTodaySchedule = async ({
  academicYearId,
  sectionId,
  semesterNumber,
  studentId,
  classroomsBySubjectId,
  todayString
}) => {
  const calendarStatus = await getCalendarStatus(todayString);

  const timetable = await Timetable.findOne({
    academicYearId,
    sectionId,
    semesterNumber
  }).lean();

  if (!calendarStatus.isWorkingDay) {
    return {
      status: 'LEAVE',
      title: calendarStatus.reasonForHoliday || 'Leave',
      dayCode: calendarStatus.dayCode,
      items: []
    };
  }

  if (!timetable) {
    return {
      status: 'NO_SCHEDULE',
      title: 'No schedule for today',
      dayCode: calendarStatus.dayCode,
      items: []
    };
  }

  const entries = await TimetableEntry.find({
    timetableId: timetable._id,
    day: calendarStatus.dayCode
  })
    .populate({
      path: 'facultyAssignmentId',
      select: 'facultyIds subjectComponentId venue',
      populate: [
        {
          path: 'facultyIds',
          select: 'firstName lastName'
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

  if (!entries.length) {
    return {
      status: 'NO_SCHEDULE',
      title: 'No schedule for today',
      dayCode: calendarStatus.dayCode,
      items: []
    };
  }

  const attendanceRecords = await Attendance.find({
    dateString: todayString,
    timetableEntry: { $in: entries.map((entry) => entry._id) }
  })
    .select('timetableEntry periodStartTime periodEndTime records')
    .lean();

  const attendanceByEntryId = new Map(
    attendanceRecords.map((attendance) => [String(attendance.timetableEntry), attendance])
  );

  const slotByOrder = new Map(
    (timetable.slots || []).map((slot) => [Number(slot.order), slot])
  );

  const items = entries.map((entry, index) => {
    const slot = slotByOrder.get(Number(entry.slotOrder));
    const assignment = entry.facultyAssignmentId;
    const component = assignment?.subjectComponentId;
    const subject = component?.subjectId;
    const faculty = Array.isArray(assignment?.facultyIds)
      ? assignment.facultyIds[0]
      : null;
    const attendance = attendanceByEntryId.get(String(entry._id));
    const studentRecord = getStudentRecord(attendance, studentId);
    const classroom = subject?._id
      ? classroomsBySubjectId.get(String(subject._id))
      : null;

    return {
      id: String(entry._id),
      slotOrder: entry.slotOrder,
      displayTime: formatDisplayTime(
        attendance?.periodStartTime || slot?.startTime,
        attendance?.periodEndTime || slot?.endTime
      ),
      subjectName: subject?.name || component?.name || `Period ${entry.slotOrder}`,
      subtitle: `${subject?.shortName || subject?.code || component?.shortName || 'Class'} / ${getYearLabel(
        semesterNumber
      )} (${classroom?.sectionId?.name || classroom?.section?.name || 'Section'})`,
      facultyName: faculty
        ? `${faculty.firstName || ''} ${faculty.lastName || ''}`.trim()
        : '',
      venue: assignment?.venue || '',
      attendanceStatus: studentRecord?.status || null,
      accentColor: ['#3B82F6', '#FB923C', '#EC4899', '#22C55E', '#A855F7', '#F97316'][
        index % 6
      ]
    };
  });

  return {
    status: 'SCHEDULED',
    title: 'Today Schedule',
    dayCode: calendarStatus.dayCode,
    items
  };
};

const ordinalLabel = (value) => {
  const remainder10 = value % 10;
  const remainder100 = value % 100;

  if (remainder10 === 1 && remainder100 !== 11) return `${value}st`;
  if (remainder10 === 2 && remainder100 !== 12) return `${value}nd`;
  if (remainder10 === 3 && remainder100 !== 13) return `${value}rd`;
  return `${value}th`;
};

const buildAttendanceHeatmap = async ({
  academicYearId,
  sectionId,
  semesterNumber,
  studentId
}) => {
  const today = new Date();
  const dates = [];
  let dayOffset = 0;

  while (dates.length < 7) {
    const current = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - dayOffset
      )
    );
    const dayCode = DAY_CODES[current.getUTCDay()];

    if (dayCode !== 'SUN') {
      dates.unshift({
        date: current,
        dateString: formatDateString(current),
        dayCode,
        label: current.toLocaleDateString('en-US', {
          weekday: 'short',
          timeZone: 'UTC'
        })
      });
    }

    dayOffset += 1;
  }

  const timetable = await Timetable.findOne({
    academicYearId,
    sectionId,
    semesterNumber
  }).lean();

  if (!timetable) {
    return {
      days: dates.map((item) => ({
        dateString: item.dateString,
        label: item.label
      })),
      rows: []
    };
  }

  const classSlots = [...(timetable.slots || [])]
    .filter((slot) => slot.type === 'class')
    .sort((a, b) => a.order - b.order);

  const timetableEntries = await TimetableEntry.find({ timetableId: timetable._id })
    .select('_id day slotOrder')
    .lean();

  const entryIds = timetableEntries.map((entry) => entry._id);
  const attendances = entryIds.length
    ? await Attendance.find({
        dateString: { $in: dates.map((item) => item.dateString) },
        timetableEntry: { $in: entryIds }
      })
        .select('dateString timetableEntry records')
        .lean()
    : [];

  const calendarEntries = await AcademicCalendar.find({
    dateString: { $in: dates.map((item) => item.dateString) }
  })
    .select('dateString isWorkingDay')
    .lean();

  const calendarByDate = new Map(
    calendarEntries.map((entry) => [entry.dateString, entry])
  );

  const attendanceByEntryDate = new Map(
    attendances.map((attendance) => [
      `${attendance.dateString}-${String(attendance.timetableEntry)}`,
      attendance
    ])
  );

  const entryByDaySlot = new Map(
    timetableEntries.map((entry) => [
      `${entry.day}-${Number(entry.slotOrder)}`,
      entry
    ])
  );

  const rows = classSlots.map((slot, rowIndex) => {
    const cells = dates.map((item) => {
      const calendarEntry = calendarByDate.get(item.dateString);
      const isWorkingDay = calendarEntry
        ? calendarEntry.isWorkingDay
        : item.dayCode !== 'SUN';

      if (!isWorkingDay) {
        return {
          percentage: null,
          tone: 'gray'
        };
      }

      const timetableEntry = entryByDaySlot.get(`${item.dayCode}-${Number(slot.order)}`);
      if (!timetableEntry) {
        return {
          percentage: null,
          tone: 'gray'
        };
      }

      const attendance = attendanceByEntryDate.get(
        `${item.dateString}-${String(timetableEntry._id)}`
      );
      const studentRecord = getStudentRecord(attendance, studentId);

      if (!studentRecord) {
        return {
          percentage: null,
          tone: 'gray'
        };
      }

      const percentage =
        studentRecord.status === 'Present' || studentRecord.status === 'OnDuty'
          ? 100
          : 0;

      return {
        percentage,
        tone: percentage < 50 ? 'red' : 'green'
      };
    });

    return {
      slotOrder: slot.order,
      label: ordinalLabel(rowIndex + 1),
      cells
    };
  });

  return {
    days: dates.map((item) => ({
      dateString: item.dateString,
      label: item.label
    })),
    rows
  };
};

export const getStudentDashboard = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'STUDENT') {
    return next(new AppError('Only students can access the dashboard', 403));
  }

  const academicYear = await resolveAcademicYear();
  const { student, academicRecord } = await getStudentAcademicContext(
    req.user._id,
    academicYear._id
  );

  const currentSectionId = academicRecord?.sectionId || student.sectionId;
  const currentSemesterNumber =
    academicRecord?.semesterNumber || student.semesterNumber;

  const [classrooms, totalStudents] = await Promise.all([
    Classroom.find({
      academicYearId: academicYear._id,
      sectionId: currentSectionId,
      semesterNumber: currentSemesterNumber,
      status: 'active',
      isDeleted: false
    })
      .select('_id subjectId sectionId semesterNumber')
      .populate({ path: 'subjectId', select: 'name code shortName' })
      .populate({ path: 'sectionId', select: 'name' })
      .lean(),
    Student.countDocuments({
      sectionId: currentSectionId,
      status: 'active'
    })
  ]);

  const classroomsBySubjectId = new Map(
    classrooms
      .filter((classroom) => classroom.subjectId?._id)
      .map((classroom) => [String(classroom.subjectId._id), classroom])
  );

  const todayString = formatDateString(new Date());
  const classroomIds = classrooms.map((classroom) => classroom._id);

  const [todaySchedule, attendanceOverview, overallAttendancePercentage] =
    await Promise.all([
      buildTodaySchedule({
        academicYearId: academicYear._id,
        sectionId: currentSectionId,
        semesterNumber: currentSemesterNumber,
        studentId: student._id,
        classroomsBySubjectId,
        todayString
      }),
      buildAttendanceHeatmap({
        academicYearId: academicYear._id,
        sectionId: currentSectionId,
        semesterNumber: currentSemesterNumber,
        studentId: student._id
      }),
      computeOverallAttendancePercentage({
        classroomIds,
        studentId: student._id
      })
    ]);

  res.status(200).json({
    success: true,
    data: {
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        registerNumber: student.registerNumber,
        rollNumber: student.rollNumber,
        semesterNumber: currentSemesterNumber,
        yearLabel: getYearLabel(currentSemesterNumber)
      },
      academicYear: {
        _id: academicYear._id,
        name: academicYear.name
      },
      cards: [
        {
          key: 'totalClasses',
          title: 'Total Classes',
          value: classrooms.length
        },
        {
          key: 'totalStudents',
          title: 'Total Classmates',
          value: totalStudents
        },
        {
          key: 'attendancePercentage',
          title: 'Overall Attendance Percentage',
          value: `${overallAttendancePercentage}%`
        }
      ],
      todaySchedule,
      attendanceOverview,
      passPercentage: {
        average: 90,
        subjects: [
          { name: 'Cyber Security', value: 90 },
          { name: 'C Programming', value: 87 },
          { name: 'Mathematics', value: 63 },
          { name: 'English', value: 53 }
        ]
      }
    }
  });
});
