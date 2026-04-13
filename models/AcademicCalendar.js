import mongoose from 'mongoose';

const academicCalendarSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Date is required'],
      unique: true
    },
    dateString: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    isWorkingDay: {
      type: Boolean,
      default: true
    },
    reasonForHoliday: {
      type: String,
      trim: true,
      default: null
    }
  },
  { timestamps: true }
);

const AcademicCalendar = mongoose.model(
  'AcademicCalendar',
  academicCalendarSchema
);
export default AcademicCalendar;
