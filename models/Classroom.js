import mongoose from 'mongoose';

const ClassroomSchema = new mongoose.Schema(
  {
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

    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true
    },

    semesterNumber: {
      type: Number,
      required: true,
      min: 1,
      index: true
    },

    facultyAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyAssignment',
      default: null,
      index: true
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true
    },

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true
    },

    academicYearLabel: {
      type: String,
      trim: true,
      default: ''
    },

    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      default: null,
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
      required: false,
      unique: true,
      index: true
    },

    primaryFacultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    },

    isArchived: {
      type: Boolean,
      default: false
    },

    archivedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

ClassroomSchema.index(
  { subjectId: 1, sectionId: 1, semesterNumber: 1 },
  { unique: true }
);

ClassroomSchema.index({ sectionId: 1, isActive: 1, isArchived: 1 });

ClassroomSchema.pre('validate', function () {
  if (!this.primaryFacultyId && this.facultyId) {
    this.primaryFacultyId = this.facultyId;
  }

  if (!this.facultyId && this.primaryFacultyId) {
    this.facultyId = this.primaryFacultyId;
  }

  if (!this.classCode && this.sectionId && this.subjectId) {
    const sectionPart = String(this.sectionId).slice(-4).toUpperCase();
    const subjectPart = String(this.subjectId).slice(-4).toUpperCase();
    const semPart = String(this.semesterNumber || 1).padStart(2, '0');
    this.classCode = `CLS-${sectionPart}-${subjectPart}-${semPart}`;
  }

  if (this.isArchived && !this.archivedAt) {
    this.archivedAt = new Date();
  }

  if (!this.isArchived) {
    this.archivedAt = null;
  }
});

export default mongoose.model('Classroom', ClassroomSchema);
