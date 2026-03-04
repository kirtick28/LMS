import mongoose from 'mongoose';

const curriculumSubjectSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },

    semesterNumber: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { _id: false }
);

const curriculumSchema = new mongoose.Schema(
  {
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true
    },

    subjects: {
      type: [curriculumSubjectSchema],
      default: []
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

/* Prevent duplicate curriculum per department */
curriculumSchema.index({ departmentId: 1 }, { unique: true });

export default mongoose.model('Curriculum', curriculumSchema);
