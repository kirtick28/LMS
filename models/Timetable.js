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
    },
    slots: [slotSchema]
  { _id: false }
  { _id: true }
);

const timetableSchema = new mongoose.Schema(
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },
    semester: {
    semesterNumber: {
      required: true
      required: true,
      min: 1,
      index: true
    section: {
      type: String,
    schedule: {
      type: [scheduleEntrySchema],
      default: []
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
    },
      trim: true,
      default: ''
    }

export default mongoose.model('Timetable', timetableSchema);


timetableSchema.index({ sectionId: 1, semesterNumber: 1 }, { unique: true });
timetableSchema.index(
  { sectionId: 1, 'schedule.dayOfWeek': 1, 'schedule.periodNumber': 1 },
  { sparse: true }
);
