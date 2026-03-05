import mongoose from 'mongoose';

const studentAcademicRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
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
      required: true,
      min: 1
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'repeat', 'completed'],
      default: 'active',
      index: true
    }
  },
  { timestamps: true }
);

studentAcademicRecordSchema.index(
  { studentId: 1, academicYearId: 1, semesterNumber: 1 },
  { unique: true }
);

export default mongoose.model(
  'StudentAcademicRecord',
  studentAcademicRecordSchema
);
