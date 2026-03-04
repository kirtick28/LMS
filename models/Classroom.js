import mongoose from 'mongoose';

const classroomSchema = new mongoose.Schema(
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
      max: 12,
      index: true
    },

    facultyAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyAssignment',
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
      unique: true,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },

    archivedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

/* ---------------- INDEXES ---------------- */
classroomSchema.index(
  { sectionId: 1, subjectId: 1, semesterNumber: 1 },
  { unique: true }
);

classroomSchema.index({ sectionId: 1, isActive: 1, isArchived: 1 });

/* ---------------- MIDDLEWARE ---------------- */
classroomSchema.pre('validate', function () {
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

export default mongoose.model('Classroom', classroomSchema);
