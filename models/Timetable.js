import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema(
  {
    time: {
      type: String,
      required: true
    },
    subjectId: {
      type: String,
      required: true
    },
    subjectName: String,
    facultyId: {
      type: String,
      required: true
    },
    facultyName: String
  },
  { _id: false }
);

const daySchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true
    },
    slots: [slotSchema]
  },
  { _id: true }
);

const timetableSchema = new mongoose.Schema(
  {
    department: {
      type: String,
      required: true
    },
    year: {
      type: String,
      required: true
    },
    semester: {
      type: Number,
      required: true
    },
    section: {
      type: String,
      required: true
    },
    days: [daySchema]
  },
  { timestamps: true }
);

export default mongoose.model('Timetable', timetableSchema);
