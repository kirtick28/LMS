import mongoose from 'mongoose';

const additionalHourSchema = new mongoose.Schema(
  {
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true
    },

    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true
    },

    semesterNumber: {
      type: Number,
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    shortName: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },

    facultyIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Faculty'
      }
    ],

    venue: {
      type: String,
      trim: true,
      default: ''
    },

    hours: {
      type: Number,
      min: 0,
      default: 1
    }
  },
  { timestamps: true }
);

additionalHourSchema.index(
  { sectionId: 1, academicYearId: 1, semesterNumber: 1, shortName: 1 },
  { unique: true }
);

additionalHourSchema.index({
  sectionId: 1,
  academicYearId: 1,
  semesterNumber: 1
});

export default mongoose.model('AdditionalHour', additionalHourSchema);
