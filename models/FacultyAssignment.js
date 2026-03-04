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

    semesterNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

/* ---------------- INDEXES ---------------- */
facultyAssignmentSchema.index(
  { sectionId: 1, subjectId: 1, semesterNumber: 1 },
  { unique: true }
);

facultyAssignmentSchema.index({ facultyId: 1, semesterNumber: 1 });
facultyAssignmentSchema.index({ sectionId: 1, semesterNumber: 1 });

/* ---------------- MIDDLEWARE ---------------- */
facultyAssignmentSchema.pre('validate', function () {
  if (this.semesterNumber < 1) {
    throw new Error('semesterNumber must be >= 1');
  }
});

export default mongoose.model('FacultyAssignment', facultyAssignmentSchema);
