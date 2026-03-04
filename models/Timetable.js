import mongoose from 'mongoose';

const scheduleEntrySchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: String,
      required: true
    },

    periodNumber: {
      type: Number,
      required: true,
      min: 1
    },

    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true
    },

    startTime: {
      type: String,
      required: true
    },

    endTime: {
      type: String,
      required: true
    }
  },
  { _id: false }
);

const timetableSchema = new mongoose.Schema(
  {
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },

    semesterNumber: {
      type: Number,
      required: true,
      min: 1,
      index: true
    },

    schedule: {
      type: [scheduleEntrySchema],
      default: []
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
timetableSchema.index({ sectionId: 1, semesterNumber: 1 }, { unique: true });

timetableSchema.index(
  { sectionId: 1, 'schedule.dayOfWeek': 1, 'schedule.periodNumber': 1 },
  { sparse: true }
);

export default mongoose.model('Timetable', timetableSchema);
