import mongoose from 'mongoose';

const classroomSchema = new mongoose.Schema(
  {
    facultyAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyAssignment',
      required: true,
      index: true
    },
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
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    classCode: {
      type: String,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true
    },
    archivedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

classroomSchema.index(
  { sectionId: 1, subjectId: 1, academicYearId: 1, semesterNumber: 1 },
  { unique: true }
);

classroomSchema.pre('validate', function () {
  if (!this.classCode && this.sectionId && this.subjectId) {
    const sectionPart = String(this.sectionId).slice(-4).toUpperCase();
    const subjectPart = String(this.subjectId).slice(-4).toUpperCase();
    const semPart = String(this.semesterNumber || 1).padStart(2, '0');

    this.classCode = `CLS-${sectionPart}-${subjectPart}-${semPart}`;
  }

  if (this.status === 'archived' && !this.archivedAt) {
    this.archivedAt = new Date();
  }

  if (this.status === 'active') {
    this.archivedAt = null;
  }
});

export default mongoose.model('Classroom', classroomSchema);
