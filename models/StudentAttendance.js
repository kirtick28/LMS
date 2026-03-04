import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'on-duty'],
      required: true
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null
    }
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true
    },

    date: {
      type: Date,
      required: true,
      index: true
    },

    records: {
      type: [attendanceRecordSchema],
      default: []
    },

    facultyAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyAssignment',
      default: null,
      index: true
    },

    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      default: null,
      index: true
    },

    academicYearLabel: {
      type: String,
      trim: true,
      default: '',
      index: true
    },

    semesterNumber: {
      type: Number,
      default: null
    },

    slotNumber: {
      type: Number,
      min: 1,
      max: 8,
      default: null
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null
    },

    status: {
      type: String,
      enum: ['Present', 'Absent', 'On-Duty'],
      default: null
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true
    },

    migratedLegacy: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

attendanceSchema.index({ classroomId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ 'records.studentId': 1, date: 1 });

attendanceSchema.pre('validate', function () {
  if (this.studentId && this.status && this.records.length === 0) {
    this.records = [
      {
        studentId: this.studentId,
        status: this.status.toLowerCase(),
        markedBy: this.markedBy || null
      }
    ];
    this.migratedLegacy = true;
  }

  if (!this.studentId && this.records.length > 0) {
    const first = this.records[0];
    this.studentId = first.studentId || null;
    this.status = first.status
      ? first.status.charAt(0).toUpperCase() + first.status.slice(1)
      : this.status;
    this.markedBy = this.markedBy || first.markedBy || null;
  }
});

export default mongoose.model('Attendance', attendanceSchema);
