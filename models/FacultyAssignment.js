import mongoose from 'mongoose';

const facultyAssignmentSchema = new mongoose.Schema(
  {
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
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
      min: 1,
      max: 12,
      index: true
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['active', 'removed'],
      default: 'active',
      index: true
    }
  },
  { timestamps: true }
);

facultyAssignmentSchema.index(
  { sectionId: 1, subjectId: 1, academicYearId: 1, semesterNumber: 1 },
  { unique: true }
);

facultyAssignmentSchema.index({
  facultyId: 1,
  academicYearId: 1,
  semesterNumber: 1
});

facultyAssignmentSchema.pre('validate', function () {
  if (this.semesterNumber < 1) {
    throw new Error('semesterNumber must be >= 1');
  }
});

export default mongoose.model('FacultyAssignment', facultyAssignmentSchema);
