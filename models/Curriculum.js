import mongoose from 'mongoose';

const curriculumSemesterSubjectSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    }
  },
  { _id: false }
);

const curriculumSemesterSchema = new mongoose.Schema(
  {
    semesterNumber: {
      type: Number,
      required: true,
      min: 1
    },
    subjects: {
      type: [curriculumSemesterSubjectSchema],
      default: []
    }
  },
  { _id: false }
);

const legacyCurriculumSubjectSchema = new mongoose.Schema(
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

    subjects: {
      type: [legacyCurriculumSubjectSchema],
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

curriculumSchema.pre('validate', function () {
  if (
    (!this.semesters || this.semesters.length === 0) &&
    this.subjects.length
  ) {
    const grouped = this.subjects.reduce((acc, row) => {
      if (!acc[row.semesterNumber]) acc[row.semesterNumber] = [];
      acc[row.semesterNumber].push({ subjectId: row.subjectId });
      return acc;
    }, {});

    this.semesters = Object.keys(grouped)
      .map((semesterNumber) => ({
        semesterNumber: Number(semesterNumber),
        subjects: grouped[semesterNumber]
      }))
      .sort((a, b) => a.semesterNumber - b.semesterNumber);
  }
});

export default mongoose.model('Curriculum', curriculumSchema);
