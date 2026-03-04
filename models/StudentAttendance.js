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

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null
    }
  },
  { timestamps: true }
);

/* ---------------- INDEXES ---------------- */
attendanceSchema.index({ classroomId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ 'records.studentId': 1, date: 1 });

export default mongoose.model('Attendance', attendanceSchema);
