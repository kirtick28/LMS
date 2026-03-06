import mongoose from 'mongoose';

const academicYearSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    startYear: {
      type: Number,
      required: true,
      index: true
    },
    endYear: {
      type: Number,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

academicYearSchema.pre('validate', function () {
  if (!this.name && this.startYear && this.endYear) {
    const end = String(this.endYear).slice(-2);
    this.name = `${this.startYear}-${end}`;
  }

  if (this.startYear >= this.endYear) {
    throw new Error('endYear must be greater than startYear');
  }

  if (this.startDate >= this.endDate) {
    throw new Error('endDate must be after startDate');
  }
});

export default mongoose.model('AcademicYear', academicYearSchema);
