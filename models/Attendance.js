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
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: function () {
        return this.isNew;
      },
      index: true
    },
    subjectComponent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubjectComponent',
      required: function () {
        return this.isNew;
      },
      index: true
    },
    slotOrder: {
      type: Number,
      required: function () {
        return this.isNew;
      },
      min: 1
    },
    day: {
      type: String,
      enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      required: function () {
        return this.isNew;
      }
    },
    periodStartTime: {
      type: String,
      default: null
    },
    periodEndTime: {
      type: String,
      default: null
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
attendanceSchema.index({ dateString: 1, 'records.student': 1 });
attendanceSchema.index({ faculty: 1, dateString: 1 });
attendanceSchema.index({ subjectComponent: 1, dateString: 1 });
attendanceSchema.index({ classroom: 1, dateString: 1, slotOrder: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
