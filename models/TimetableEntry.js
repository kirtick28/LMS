import mongoose from 'mongoose';

const timetableEntrySchema = new mongoose.Schema(
  {
    timetableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Timetable',
      required: true,
      index: true
    },

    day: {
      type: String,
      enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      required: true
    },

    slotOrder: {
      type: Number,
      required: true,
      min: 1
    },

    facultyAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyAssignment',
      default: null
    },

    additionalHourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdditionalHour',
      default: null
    }
  },
  { timestamps: true }
);

timetableEntrySchema.index(
  { timetableId: 1, day: 1, slotOrder: 1 },
  { unique: true }
);
timetableEntrySchema.index({ timetableId: 1, day: 1 });
timetableEntrySchema.index({ facultyAssignmentId: 1, day: 1 });
timetableEntrySchema.index({ additionalHourId: 1 });

export default mongoose.model('TimetableEntry', timetableEntrySchema);
