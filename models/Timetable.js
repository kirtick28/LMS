import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema(
  {
    order: {
      type: Number,
      required: true,
      min: 1
    },

    startTime: {
      type: String,
      required: true
    },

    endTime: {
      type: String,
      required: true
    },

    type: {
      type: String,
      enum: ['class', 'break', 'lunch'],
      default: 'class'
    }
  },
  { _id: false }
);

const timetableSchema = new mongoose.Schema(
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
      required: true,
      min: 1,
      max: 8
    },

    slots: {
      type: [slotSchema],
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: 'Timetable must contain at least one slot'
      }
    }
  },
  { timestamps: true }
);

/*
Only one timetable per
section + academicYear + semester
*/
timetableSchema.index(
  { sectionId: 1, academicYearId: 1, semesterNumber: 1 },
  { unique: true }
);

/*
Fast lookup when loading timetable
*/
timetableSchema.index({ sectionId: 1, semesterNumber: 1 });

export default mongoose.model('Timetable', timetableSchema);
