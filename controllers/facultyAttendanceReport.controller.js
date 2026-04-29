import mongoose from 'mongoose';
import XLSX from 'xlsx';
import Attendance from '../models/Attendance.js';
import Classroom from '../models/Classroom.js';
import Faculty from '../models/Faculty.js';
import FacultyAssignment from '../models/FacultyAssignment.js';
import Student from '../models/Student.js';
import StudentAcademicRecord from '../models/StudentAcademicRecord.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import { resolveAcademicYear } from '../utils/classroomAccess.js';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const pad = (value) => String(value).padStart(2, '0');

const formatDateString = (date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;

const formatDisplayDate = (dateString) => {
  const [year, month, day] = String(dateString).split('-');
  return `${day}/${month}/${year}`;
};

const formatMonthLabel = (monthValue) => {
  const [year, month] = String(monthValue).split('-');
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return monthValue;
  return `${MONTH_LABELS[monthIndex]} ${year}`;
};

const getLastDateOfMonth = (year, monthNumber) =>
  new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

const toRoman = (value) => {
  const romanMap = [
    { value: 10, symbol: 'X' },
    { value: 9, symbol: 'IX' },
    { value: 5, symbol: 'V' },
    { value: 4, symbol: 'IV' },
    { value: 1, symbol: 'I' }
  ];

  let remaining = Number(value) || 0;
  let result = '';

  romanMap.forEach(({ value: romanValue, symbol }) => {
    while (remaining >= romanValue) {
      result += symbol;
      remaining -= romanValue;
    }
  });

  return result || String(value || '');
};

const getOrdinal = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return `${value}`;
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const mod100 = number % 100;
  const suffix =
    suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0];
  return `${number}${suffix}`;
};

const getClassHourLabel = (slotOrder) => `${getOrdinal(slotOrder)} Hour`;

const getSemesterType = (semesterNumber) =>
  Number(semesterNumber) % 2 === 0 ? 'even' : 'odd';

const normalizeSearch = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const isValidDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));

const isValidMonthValue = (value) => /^\d{4}-\d{2}$/.test(String(value));

const calculateCounts = (records = []) =>
  records.reduce(
    (accumulator, record) => {
      if (record.status === 'Present') accumulator.presentCount += 1;
      else if (record.status === 'Absent') accumulator.absentCount += 1;
      else if (record.status === 'OnDuty') accumulator.onDutyCount += 1;

      accumulator.totalCount += 1;
      return accumulator;
    },
    {
      presentCount: 0,
      absentCount: 0,
      onDutyCount: 0,
      totalCount: 0
    }
  );

const calculatePercentage = ({
  presentCount = 0,
  onDutyCount = 0,
  totalCount = 0
}) => {
  if (!totalCount) return 0;
  return Math.round(((presentCount + onDutyCount) / totalCount) * 100);
};

const buildAcademicMonths = (academicYear) => {
  const startMonth = Number(academicYear?.startMonth || 6);
  const endMonth = Number(academicYear?.endMonth || 5);
  const startYear = Number(academicYear?.startYear);
  const endYear = Number(academicYear?.endYear);

  const startDate = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const endDate = new Date(Date.UTC(endYear, endMonth - 1, 1));

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate > endDate
  ) {
    return [];
  }

  const months = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate && months.length < 18) {
    const year = cursor.getUTCFullYear();
    const monthNumber = cursor.getUTCMonth() + 1;
    const monthValue = `${year}-${pad(monthNumber)}`;
    const endDateString = `${year}-${pad(monthNumber)}-${pad(
      getLastDateOfMonth(year, monthNumber)
    )}`;

    months.push({
      monthValue,
      monthLabel: MONTH_LABELS[monthNumber - 1],
      shortLabel: MONTH_LABELS[monthNumber - 1].slice(0, 3),
      startDateString: `${year}-${pad(monthNumber)}-01`,
      endDateString
    });

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
};

const getSemesterWindow = (academicYear, semesterType) => {
  const months = buildAcademicMonths(academicYear);
  const midpoint = Math.ceil(months.length / 2);
  const semesterMonths =
    semesterType === 'odd' ? months.slice(0, midpoint) : months.slice(midpoint);

  if (!semesterMonths.length) {
    throw new AppError('Academic year months are not configured correctly', 400);
  }

  return {
    semesterType,
    months: semesterMonths,
    fromDate: semesterMonths[0].startDateString,
    toDate: semesterMonths[semesterMonths.length - 1].endDateString
  };
};

const resolveWindowLabel = ({ reportType, month, fromDate, toDate, semesterType }) => {
  if (reportType === 'semester') {
    return semesterType === 'odd' ? 'Odd Semester' : 'Even Semester';
  }

  if (reportType === 'month') {
    return formatMonthLabel(month);
  }

  return `${formatDisplayDate(fromDate)} - ${formatDisplayDate(toDate)}`;
};

const resolveReportWindow = ({ academicYear, semesterType, reportType, month, fromDate, toDate }) => {
  const semesterWindow = getSemesterWindow(academicYear, semesterType);

  if (!['semester', 'month', 'date-range'].includes(reportType)) {
    throw new AppError(
      'reportType must be semester, month, or date-range',
      400
    );
  }

  if (reportType === 'semester') {
    return {
      reportType,
      semesterType,
      fromDate: semesterWindow.fromDate,
      toDate: semesterWindow.toDate,
      label: resolveWindowLabel({ reportType, semesterType }),
      months: semesterWindow.months
    };
  }

  if (reportType === 'month') {
    if (!isValidMonthValue(month)) {
      throw new AppError('month must be in YYYY-MM format', 400);
    }

    const selectedMonth = semesterWindow.months.find(
      (item) => item.monthValue === month
    );

    if (!selectedMonth) {
      throw new AppError(
        'Selected month is not available for this class semester',
        400
      );
    }

    return {
      reportType,
      semesterType,
      month: selectedMonth.monthValue,
      fromDate: selectedMonth.startDateString,
      toDate: selectedMonth.endDateString,
      label: resolveWindowLabel({
        reportType,
        month: selectedMonth.monthValue,
        semesterType
      }),
      months: semesterWindow.months
    };
  }

  if (!isValidDateString(fromDate) || !isValidDateString(toDate)) {
    throw new AppError('fromDate and toDate must be in YYYY-MM-DD format', 400);
  }

  if (fromDate > toDate) {
    throw new AppError('fromDate cannot be after toDate', 400);
  }

  if (fromDate < semesterWindow.fromDate || toDate > semesterWindow.toDate) {
    throw new AppError(
      'Selected date range must fall within the class semester window',
      400
    );
  }

  return {
    reportType,
    semesterType,
    fromDate,
    toDate,
    label: resolveWindowLabel({
      reportType,
      fromDate,
      toDate,
      semesterType
    }),
    months: semesterWindow.months
  };
};

const getFacultyProfile = async (userId) => {
  const faculty = await Faculty.findOne({ userId })
    .select('_id firstName lastName')
    .lean();

  if (!faculty) {
    throw new AppError('Faculty profile not found', 404);
  }

  return faculty;
};

const getClassroomContext = async (facultyId, classroomId, activeAcademicYearId) => {
  if (!mongoose.Types.ObjectId.isValid(String(classroomId))) {
    throw new AppError('Invalid classroomId', 400);
  }

  const classroom = await Classroom.findOne({
    _id: classroomId,
    academicYearId: activeAcademicYearId,
    isDeleted: false,
    status: 'active'
  })
    .populate({
      path: 'subjectId',
      select: 'name code shortName'
    })
    .populate({
      path: 'academicYearId',
      select: 'name startYear endYear startMonth endMonth'
    })
    .populate({
      path: 'sectionId',
      select: 'name batchProgramId',
      populate: {
        path: 'batchProgramId',
        select: 'batchId departmentId',
        populate: [
          {
            path: 'batchId',
            select: 'startYear endYear name'
          },
          {
            path: 'departmentId',
            select: 'name code'
          }
        ]
      }
    })
    .lean();

  if (!classroom) {
    throw new AppError('Classroom not found for the active academic year', 404);
  }

  const assignments = await FacultyAssignment.find({
    facultyIds: facultyId,
    sectionId: classroom.sectionId?._id || classroom.sectionId,
    academicYearId: activeAcademicYearId,
    semesterNumber: classroom.semesterNumber,
    status: 'active'
  })
    .populate({
      path: 'subjectComponentId',
      select: 'name shortName componentType subjectId',
      populate: {
        path: 'subjectId',
        select: 'name code shortName'
      }
    })
    .lean();

  const matchingAssignments = assignments.filter((assignment) => {
    const subjectId =
      assignment.subjectComponentId?.subjectId?._id ||
      assignment.subjectComponentId?.subjectId;
    return String(subjectId) === String(classroom.subjectId?._id || classroom.subjectId);
  });

  if (!matchingAssignments.length) {
    throw new AppError(
      'You are not assigned to this subject for the selected class',
      403
    );
  }

  const rosterRecords = await StudentAcademicRecord.find({
    academicYearId: activeAcademicYearId,
    sectionId: classroom.sectionId?._id || classroom.sectionId,
    semesterNumber: classroom.semesterNumber,
    status: 'active'
  })
    .select('studentId')
    .lean();

  const studentIds = rosterRecords.map((item) => item.studentId);

  const students = studentIds.length
    ? await Student.find({
        _id: { $in: studentIds },
        status: 'active'
      })
        .select('_id firstName lastName registerNumber rollNumber')
        .sort({ rollNumber: 1, registerNumber: 1, firstName: 1 })
        .lean()
    : [];

  return {
    classroom,
    roster: students
  };
};

const getClassLabel = (classroom) => {
  const departmentCode =
    classroom?.sectionId?.batchProgramId?.departmentId?.code || '';
  const sectionName = classroom?.sectionId?.name || '';
  const yearLabel = toRoman(Math.ceil(Number(classroom?.semesterNumber || 1) / 2));
  return [yearLabel, departmentCode, sectionName].filter(Boolean).join(' ');
};

const getBaseReportMeta = ({ classroom, reportWindow }) => ({
  classroom: {
    classroomId: classroom._id,
    label: getClassLabel(classroom),
    semesterNumber: classroom.semesterNumber,
    semesterType: getSemesterType(classroom.semesterNumber),
    section: {
      _id: classroom.sectionId?._id || classroom.sectionId,
      name: classroom.sectionId?.name || ''
    },
    department: {
      name: classroom.sectionId?.batchProgramId?.departmentId?.name || '',
      code: classroom.sectionId?.batchProgramId?.departmentId?.code || ''
    },
    subject: {
      _id: classroom.subjectId?._id || classroom.subjectId,
      name: classroom.subjectId?.name || '',
      code: classroom.subjectId?.code || '',
      shortName: classroom.subjectId?.shortName || ''
    },
    academicYear: {
      _id: classroom.academicYearId?._id || classroom.academicYearId,
      name: classroom.academicYearId?.name || ''
    }
  },
  filter: {
    reportType: reportWindow.reportType,
    semesterType: reportWindow.semesterType,
    month: reportWindow.month || null,
    fromDate: reportWindow.fromDate,
    toDate: reportWindow.toDate,
    label: reportWindow.label,
    availableMonths: reportWindow.months.map((item) => ({
      value: item.monthValue,
      label: item.monthLabel,
      shortLabel: item.shortLabel
    }))
  }
});

const getAttendanceData = async ({ classroomId, fromDate, toDate }) =>
  Attendance.find({
    classroom: classroomId,
    dateString: {
      $gte: fromDate,
      $lte: toDate
    }
  })
    .select(
      '_id dateString slotOrder periodStartTime periodEndTime records markedAt'
    )
    .sort({ dateString: 1, slotOrder: 1, markedAt: 1 })
    .lean();

const buildStudentMap = (students) =>
  new Map(students.map((student) => [String(student._id), student]));

const mergeStudentsById = (...studentLists) => {
  const mergedMap = new Map();

  studentLists.flat().forEach((student) => {
    if (!student?._id) return;

    const key = String(student._id);
    const previous = mergedMap.get(key) || {};

    mergedMap.set(key, {
      ...previous,
      ...student,
      firstName: student.firstName || previous.firstName || '',
      lastName: student.lastName || previous.lastName || '',
      rollNumber: student.rollNumber || previous.rollNumber || '',
      registerNumber: student.registerNumber || previous.registerNumber || ''
    });
  });

  return [...mergedMap.values()];
};

const extractAttendanceStudentIds = (attendances = []) => [
  ...new Set(
    attendances.flatMap((attendance) =>
      (attendance.records || []).map((record) => String(record.student))
    )
  )
].filter((studentId) => mongoose.Types.ObjectId.isValid(studentId));

const resolveStudentDirectory = async ({
  roster = [],
  attendances = [],
  sectionId
}) => {
  const attendanceStudentIds = extractAttendanceStudentIds(attendances);

  const [attendanceStudents, sectionStudents] = await Promise.all([
    attendanceStudentIds.length
      ? Student.find({
          _id: { $in: attendanceStudentIds }
        })
          .select('_id firstName lastName registerNumber rollNumber')
          .lean()
      : [],
    roster.length || !sectionId
      ? []
      : Student.find({
          sectionId,
          status: 'active'
        })
          .select('_id firstName lastName registerNumber rollNumber')
          .sort({ rollNumber: 1, registerNumber: 1, firstName: 1 })
          .lean()
  ]);

  return mergeStudentsById(roster, sectionStudents, attendanceStudents);
};

const buildClassSummary = (attendances) => {
  const summary = attendances.reduce(
    (accumulator, attendance) => {
      const counts = calculateCounts(attendance.records);
      accumulator.totalClasses += 1;
      accumulator.presentCount += counts.presentCount;
      accumulator.absentCount += counts.absentCount;
      accumulator.onDutyCount += counts.onDutyCount;
      accumulator.totalCount += counts.totalCount;
      return accumulator;
    },
    {
      totalClasses: 0,
      presentCount: 0,
      absentCount: 0,
      onDutyCount: 0,
      totalCount: 0
    }
  );

  return {
    ...summary,
    attendancePercentage: calculatePercentage(summary)
  };
};

const buildClasswisePeriodRows = (attendances, studentMap) =>
  attendances.map((attendance) => {
    const counts = calculateCounts(attendance.records);

    return {
      attendanceId: attendance._id,
      date: formatDisplayDate(attendance.dateString),
      dateValue: attendance.dateString,
      classHour: getClassHourLabel(attendance.slotOrder),
      slotOrder: attendance.slotOrder,
      totalStudents: counts.totalCount,
      presentCount: counts.presentCount,
      absentCount: counts.absentCount,
      onDutyCount: counts.onDutyCount,
      attendancePercentage: calculatePercentage(counts),
      details: {
        title: `${formatDisplayDate(attendance.dateString)} ${getClassHourLabel(
          attendance.slotOrder
        )}`,
        summary: {
          totalStudents: counts.totalCount,
          presentCount: counts.presentCount,
          absentCount: counts.absentCount,
          onDutyCount: counts.onDutyCount
        },
        items: (attendance.records || []).map((record) => {
          const student = studentMap.get(String(record.student));
          return {
            id: String(record.student),
            title: student
              ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
              : 'Student',
            subtitle:
              student?.rollNumber || student?.registerNumber || 'Roll not available',
            status: record.status,
            remarks: record.remarks || ''
          };
        })
      }
    };
  });

const buildClasswiseSemesterRows = (attendances, availableMonths) => {
  const monthAccumulator = new Map();

  availableMonths.forEach((monthItem) => {
    monthAccumulator.set(monthItem.monthValue, {
      month: monthItem.monthLabel,
      monthValue: monthItem.monthValue,
      totalClasses: 0,
      presentCount: 0,
      absentCount: 0,
      onDutyCount: 0,
      totalCount: 0,
      attendancePercentage: 0
    });
  });

  attendances.forEach((attendance) => {
    const monthValue = attendance.dateString.slice(0, 7);
    if (!monthAccumulator.has(monthValue)) return;

    const counts = calculateCounts(attendance.records);
    const monthRow = monthAccumulator.get(monthValue);
    monthRow.totalClasses += 1;
    monthRow.presentCount += counts.presentCount;
    monthRow.absentCount += counts.absentCount;
    monthRow.onDutyCount += counts.onDutyCount;
    monthRow.totalCount += counts.totalCount;
  });

  return [...monthAccumulator.values()].map((row) => ({
    ...row,
    attendancePercentage: calculatePercentage(row)
  }));
};

const matchesStudentSearch = (student, searchValue) => {
  const query = normalizeSearch(searchValue);
  if (!query) return false;

  const fullName = normalizeSearch(
    `${student.firstName || ''} ${student.lastName || ''}`
  );

  return [fullName, student.rollNumber, student.registerNumber]
    .filter(Boolean)
    .some((candidate) => normalizeSearch(candidate).includes(query));
};

const buildStudentwiseRows = ({
  attendances,
  matchedStudents,
  reportType
}) => {
  const matchedStudentMap = new Map(
    matchedStudents.map((student) => [String(student._id), student])
  );

  const rowMap = new Map();

  attendances.forEach((attendance) => {
    const monthValue = attendance.dateString.slice(0, 7);
    const sessionDate = formatDisplayDate(attendance.dateString);
    const classHour = getClassHourLabel(attendance.slotOrder);

    (attendance.records || []).forEach((record) => {
      const student = matchedStudentMap.get(String(record.student));
      if (!student) return;

      const key =
        reportType === 'semester'
          ? `${student._id}:${monthValue}`
          : String(student._id);

      if (!rowMap.has(key)) {
        rowMap.set(key, {
          studentId: student._id,
          rollNo: student.rollNumber || student.registerNumber || '',
          registerNumber: student.registerNumber || '',
          name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
          month: reportType === 'semester' ? formatMonthLabel(monthValue) : undefined,
          monthValue: reportType === 'semester' ? monthValue : undefined,
          totalClasses: 0,
          presentCount: 0,
          absentCount: 0,
          onDutyCount: 0,
          attendancePercentage: 0,
          details: {
            title: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
            subtitle:
              student.rollNumber || student.registerNumber || 'Roll not available',
            summary: {
              totalClasses: 0,
              presentCount: 0,
              absentCount: 0,
              onDutyCount: 0
            },
            items: []
          }
        });
      }

      const row = rowMap.get(key);
      row.totalClasses += 1;
      row.details.summary.totalClasses += 1;

      if (record.status === 'Present') {
        row.presentCount += 1;
        row.details.summary.presentCount += 1;
      } else if (record.status === 'Absent') {
        row.absentCount += 1;
        row.details.summary.absentCount += 1;
      } else if (record.status === 'OnDuty') {
        row.onDutyCount += 1;
        row.details.summary.onDutyCount += 1;
      }

      row.details.items.push({
        id: `${student._id}-${attendance._id}`,
        title: `${sessionDate} ${classHour}`,
        subtitle: record.remarks || '',
        status: record.status
      });
    });
  });

  return [...rowMap.values()]
    .map((row) => ({
      ...row,
      attendancePercentage: calculatePercentage({
        presentCount: row.presentCount,
        onDutyCount: row.onDutyCount,
        totalCount: row.totalClasses
      })
    }))
    .sort((left, right) => {
      if (reportType === 'semester') {
        if (left.rollNo !== right.rollNo) {
          return String(left.rollNo).localeCompare(String(right.rollNo));
        }
        return String(left.monthValue).localeCompare(String(right.monthValue));
      }

      return String(left.rollNo).localeCompare(String(right.rollNo));
    });
};

const buildClasswiseReportData = async ({ userId, query }) => {
  const faculty = await getFacultyProfile(userId);
  const activeAcademicYear = await resolveAcademicYear();
  const classroomId = query.classroomId;

  if (!classroomId) {
    throw new AppError('classroomId is required', 400);
  }

  const { classroom, roster } = await getClassroomContext(
    faculty._id,
    classroomId,
    activeAcademicYear._id
  );

  const semesterType = getSemesterType(classroom.semesterNumber);
  const reportWindow = resolveReportWindow({
    academicYear: classroom.academicYearId,
    semesterType,
    reportType: String(query.reportType || ''),
    month: query.month,
    fromDate: query.fromDate,
    toDate: query.toDate
  });

  const attendances = await getAttendanceData({
    classroomId: classroom._id,
    fromDate: reportWindow.fromDate,
    toDate: reportWindow.toDate
  });
  const studentDirectory = await resolveStudentDirectory({
    roster,
    attendances,
    sectionId: classroom.sectionId?._id || classroom.sectionId
  });

  const baseMeta = getBaseReportMeta({ classroom, reportWindow });
  const summary = {
    ...buildClassSummary(attendances),
    title:
      reportWindow.reportType === 'semester'
        ? `Overall attendance Percentage for ${classroom.subjectId?.name || 'Subject'}`
        : `${reportWindow.label} attendance Percentage for ${
            classroom.subjectId?.name || 'Subject'
          }`
  };

  const rows =
    reportWindow.reportType === 'semester'
      ? buildClasswiseSemesterRows(attendances, reportWindow.months)
      : buildClasswisePeriodRows(attendances, buildStudentMap(studentDirectory));

  return {
    ...baseMeta,
    summary,
    rows
  };
};

const buildStudentwiseReportData = async ({ userId, query }) => {
  const faculty = await getFacultyProfile(userId);
  const activeAcademicYear = await resolveAcademicYear();
  const classroomId = query.classroomId;

  if (!classroomId) {
    throw new AppError('classroomId is required', 400);
  }

  const { classroom, roster } = await getClassroomContext(
    faculty._id,
    classroomId,
    activeAcademicYear._id
  );

  const semesterType = getSemesterType(classroom.semesterNumber);
  const reportWindow = resolveReportWindow({
    academicYear: classroom.academicYearId,
    semesterType,
    reportType: String(query.reportType || ''),
    month: query.month,
    fromDate: query.fromDate,
    toDate: query.toDate
  });

  const attendances = await getAttendanceData({
    classroomId: classroom._id,
    fromDate: reportWindow.fromDate,
    toDate: reportWindow.toDate
  });
  const studentDirectory = await resolveStudentDirectory({
    roster,
    attendances,
    sectionId: classroom.sectionId?._id || classroom.sectionId
  });

  const search = String(query.search || '').trim();
  const matchedStudents = search
    ? studentDirectory.filter((student) => matchesStudentSearch(student, search))
    : [];

  const baseMeta = getBaseReportMeta({ classroom, reportWindow });

  return {
    ...baseMeta,
    summary: {
      ...buildClassSummary(attendances),
      title:
        reportWindow.reportType === 'semester'
          ? `Overall attendance Percentage for ${
              classroom.subjectId?.name || 'Subject'
            }`
          : `${reportWindow.label} attendance Percentage for ${
              classroom.subjectId?.name || 'Subject'
            }`
    },
    requiresSearch: !search,
    search,
    matchedStudentsCount: matchedStudents.length,
    rows: search
      ? buildStudentwiseRows({
          attendances,
          matchedStudents,
          reportType: reportWindow.reportType
        })
      : []
  };
};

const buildWorkbookBuffer = (sheetName, rows, detailsRows = []) => {
  const workbook = XLSX.utils.book_new();
  const mainRows = rows.length ? rows : [{ Info: 'No data available' }];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(mainRows),
    sheetName
  );

  if (detailsRows.length) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(detailsRows),
      'Details'
    );
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const sendWorkbook = (res, buffer, fileName) => {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
};

const sanitizeFileToken = (value) =>
  String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

export const getFacultyAttendanceClasswiseReport = catchAsync(
  async (req, res) => {
    const report = await buildClasswiseReportData({
      userId: req.user._id,
      query: req.query
    });

    res.status(200).json({
      success: true,
      data: report
    });
  }
);

export const downloadFacultyAttendanceClasswiseReport = catchAsync(
  async (req, res) => {
    const report = await buildClasswiseReportData({
      userId: req.user._id,
      query: req.query
    });

    const summaryRows =
      report.filter.reportType === 'semester'
        ? report.rows.map((row) => ({
            Month: row.month,
            'Total Classes': row.totalClasses,
            'Present Count': row.presentCount,
            'Absent Count': row.absentCount,
            'On Duty Count': row.onDutyCount,
            'Attendance Percentage': `${row.attendancePercentage}%`
          }))
        : report.rows.map((row) => ({
            Date: row.date,
            'Class Hour': row.classHour,
            'Total Students': row.totalStudents,
            'Present Count': row.presentCount,
            'Absent Count': row.absentCount,
            'On Duty Count': row.onDutyCount,
            'Attendance Percentage': `${row.attendancePercentage}%`
          }));

    const detailRows =
      report.filter.reportType === 'semester'
        ? []
        : report.rows.flatMap((row) =>
            (row.details?.items || []).map((item) => ({
              Date: row.date,
              'Class Hour': row.classHour,
              'Roll Number': item.subtitle,
              'Student Name': item.title,
              Status: item.status,
              Remarks: item.remarks || ''
            }))
          );

    const buffer = buildWorkbookBuffer('Classwise Report', summaryRows, detailRows);
    const fileName = `${sanitizeFileToken(
      report.classroom.subject.name
    )}_${sanitizeFileToken(report.classroom.label)}_${sanitizeFileToken(
      report.filter.label
    )}_classwise.xlsx`;

    sendWorkbook(res, buffer, fileName);
  }
);

export const getFacultyAttendanceStudentwiseReport = catchAsync(
  async (req, res) => {
    const report = await buildStudentwiseReportData({
      userId: req.user._id,
      query: req.query
    });

    res.status(200).json({
      success: true,
      data: report
    });
  }
);

export const downloadFacultyAttendanceStudentwiseReport = catchAsync(
  async (req, res) => {
    const report = await buildStudentwiseReportData({
      userId: req.user._id,
      query: req.query
    });

    if (!report.search) {
      throw new AppError('search is required to download studentwise reports', 400);
    }

    const summaryRows =
      report.filter.reportType === 'semester'
        ? report.rows.map((row) => ({
            Month: row.month,
            'Roll Number': row.rollNo,
            'Student Name': row.name,
            'Total Classes': row.totalClasses,
            'Present Count': row.presentCount,
            'Absent Count': row.absentCount,
            'On Duty Count': row.onDutyCount,
            'Attendance Percentage': `${row.attendancePercentage}%`
          }))
        : report.rows.map((row) => ({
            'Roll Number': row.rollNo,
            'Student Name': row.name,
            'Total Classes': row.totalClasses,
            'Present Count': row.presentCount,
            'Absent Count': row.absentCount,
            'On Duty Count': row.onDutyCount,
            'Attendance Percentage': `${row.attendancePercentage}%`
          }));

    const detailRows = report.rows.flatMap((row) =>
      (row.details?.items || []).map((item) => ({
        'Roll Number': row.rollNo,
        'Student Name': row.name,
        Session: item.title,
        Status: item.status,
        Remarks: item.subtitle || ''
      }))
    );

    const buffer = buildWorkbookBuffer(
      'Studentwise Report',
      summaryRows,
      detailRows
    );
    const fileName = `${sanitizeFileToken(
      report.classroom.subject.name
    )}_${sanitizeFileToken(report.classroom.label)}_${sanitizeFileToken(
      report.search
    )}_studentwise.xlsx`;

    sendWorkbook(res, buffer, fileName);
  }
);
