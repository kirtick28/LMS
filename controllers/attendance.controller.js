import TimetableEntry from '../models/TimetableEntry.js';
import AcademicYear from '../models/AcademicYear.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

export const markAttendance = catchAsync(async (req, res, next) => {
  const { timetableEntryId, date, students, sectionId } = req.body;

  if (!timetableEntryId || !date || !students) {
    return next(
      new AppError(
        'Please provide timetableEntryId, date, and students list',
        400
      )
    );
  }

  // 1. Fetch the Timetable Entry and link to the Timetable
  const entry =
    await TimetableEntry.findById(timetableEntryId).populate('timetableId');
  if (!entry) {
    return next(new AppError('Timetable entry not found', 404));
  }

  // 2. Validate the Day of the Week
  const daysMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const inputDate = new Date(date);
  const dayName = daysMap[inputDate.getDay()]; // Returns 'MON', 'TUE', etc.

  if (dayName !== entry.day) {
    return next(
      new AppError(
        `Invalid day. This timetable entry is for ${entry.day}, but the provided date is a ${dayName}.`,
        400
      )
    );
  }

  // 3. Validate Academic Year Status
  const academicYear = await AcademicYear.findById(
    entry.timetableId.academicYearId
  );
  if (!academicYear || !academicYear.isActive) {
    return next(
      new AppError(
        'Attendance cannot be marked for an inactive academic year',
        400
      )
    );
  }

  // 4. (Optional) Check if attendance is already marked for this entry on this date
  // This depends on your Attendance model schema (e.g. Attendance.findOne({ timetableEntryId, date }))

  // 5. Save Attendance Records
  // Map through your students list and save to your Attendance model
  // const attendanceRecords = students.map(s => ({
  //   studentId: s.studentId,
  //   status: s.status, // 'present', 'absent'
  //   date: inputDate,
  //   timetableEntryId,
  //   sectionId: entry.timetableId.sectionId
  // }));
  // await Attendance.insertMany(attendanceRecords);

  res.status(201).json({
    success: true,
    message: `Attendance marked successfully for ${dayName} (${date})`,
    data: {
      slotOrder: entry.slotOrder,
      day: entry.day
    }
  });
});

/**
 * Faculty creates a request to change locked attendance
 */
export const requestAttendanceChange = async (req, res) => {
  try {
    const { attendanceId, requestedChanges, reason } = req.body;
    const facultyId = req.user._id; // Assuming auth middleware

    const request = new AttendanceRequest({
      attendanceRecord: attendanceId,
      faculty: facultyId,
      requestedChanges,
      reason,
      approvalStatus: 'Pending'
    });

    await request.save();
    res.status(201).json({
      success: true,
      message: 'Change request submitted to HOD',
      data: request
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * HOD Approval/Rejection Logic
 */
export const resolveAttendanceRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { requestId, status, reviewRemarks } = req.body;
    const hodId = req.user._id;

    const request =
      await AttendanceRequest.findById(requestId).session(session);
    if (!request || request.approvalStatus !== 'Pending') {
      throw new Error('Request not found or already resolved.');
    }

    request.approvalStatus = status;
    request.reviewedBy = hodId;
    request.reviewRemarks = reviewRemarks;
    request.resolvedAt = new Date();

    if (status === 'Approved') {
      const attendance = await Attendance.findById(
        request.attendanceRecord
      ).session(session);

      // Update individual student records within the attendance sheet
      request.requestedChanges.forEach((change) => {
        const recordIndex = attendance.records.findIndex(
          (r) => r.student.toString() === change.student.toString()
        );
        if (recordIndex !== -1) {
          attendance.records[recordIndex].status = change.newStatus;
        }
      });

      attendance.status = 'UPDATED_BY_HOD';
      await attendance.save({ session });
    }

    await request.save({ session });
    await session.commitTransaction();

    res.status(200).json({ success: true, message: `Request ${status}` });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

/**
 * Get Attendance for a specific classroom and date
 */
export const getAttendanceByClassroom = async (req, res) => {
  try {
    const { classroomId, dateString } = req.query;
    const data = await Attendance.findOne({
      classroom: classroomId,
      dateString
    }).populate('records.student', 'name rollNumber');
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
