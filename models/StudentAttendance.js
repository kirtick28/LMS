import mongoose from 'mongoose';

const studentAttendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true
    },

    facultyAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyAssignment',
      required: true,
      index: true
    },

    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
      index: true
    },

    semesterNumber: {
      type: Number,
      required: true
    },

    date: {
      type: Date,
      required: true,
      index: true
    },

    slotNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 8
    },

    status: {
      type: String,
      enum: ['Present', 'Absent', 'On-Duty'],
      required: true
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true
    }
  },
  { timestamps: true }
);

// Prevent duplicate attendance entry
studentAttendanceSchema.index(
  { studentId: 1, facultyAssignmentId: 1, date: 1, slotNumber: 1 },
  { unique: true }
);

export default mongoose.model('StudentAttendance', studentAttendanceSchema);
