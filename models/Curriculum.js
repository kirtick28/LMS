import mongoose from 'mongoose';

const curriculumSemesterSchema = new mongoose.Schema(
  {
    semesterNumber: {
      type: Number,
      required: true,
      min: 1
    },
    subjects: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Subject'
        }
      ],
      default: []
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

    regulationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Regulation',
      required: true,
      index: true
    },

    semesters: {
      type: [curriculumSemesterSchema],
      default: []
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

curriculumSchema.index({ departmentId: 1, regulationId: 1 }, { unique: true });

export default mongoose.model('Curriculum', curriculumSchema);
