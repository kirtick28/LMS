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

/*
Prevent two entries occupying same slot
*/
timetableEntrySchema.index(
  { timetableId: 1, day: 1, slotOrder: 1 },
  { unique: true }
);

/*
Fast rendering of timetable
*/
timetableEntrySchema.index({ timetableId: 1, day: 1 });

/*
Faculty clash detection
*/
timetableEntrySchema.index({ facultyAssignmentId: 1, day: 1 });

/*
Additional hour lookup
*/
timetableEntrySchema.index({ additionalHourId: 1 });

export default mongoose.model('TimetableEntry', timetableEntrySchema);
