import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'OnDuty'],
      required: true
    },
    remarks: {
      type: String,
      trim: true
    } // For things like "Late by 10 mins" or "OD for Symposium"
  },
  { _id: false }
); // Disable _id for subdocuments to save space

const attendanceSchema = new mongoose.Schema(
  {
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true
    },
    timetableEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimetableEntry',
      required: true
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true
    },

    // Storing the date in UTC and a normalized string for bulletproof querying
    date: {
      type: Date,
      required: true
    },
    dateString: {
      type: String,
      required: true // Format: "YYYY-MM-DD"
    },

    status: {
      type: String,
      enum: ['MARKED', 'MISSED', 'UPDATED_BY_HOD'],
      default: 'MARKED'
    },

    // Locks immediately upon creation.
    isLocked: {
      type: Boolean,
      default: true
    },

    // The actual student attendance data
    records: [attendanceRecordSchema],

    markedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// CRITICAL INDEX: Ensures a faculty cannot accidentally create two attendance sheets
// for the exact same classroom, slot, and day.
attendanceSchema.index(
  { classroom: 1, timetableEntry: 1, dateString: 1 },
  { unique: true }
);

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
