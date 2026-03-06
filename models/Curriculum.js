import mongoose from 'mongoose';

const curriculumSemesterSchema = new mongoose.Schema(
  {
    semesterNumber: {
      type: Number,
      required: true,
      min: 1
    },
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
      }
    ]
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

curriculumSchema.index({
  departmentId: 1,
  regulationId: 1,
  'semesters.semesterNumber': 1
});

curriculumSchema.pre('validate', function () {
  const semesters = this.semesters.map((s) => s.semesterNumber);
  const unique = new Set(semesters);

  if (unique.size !== semesters.length) {
    throw new Error('Duplicate semesterNumber in curriculum');
  }
});

export default mongoose.model('Curriculum', curriculumSchema);
