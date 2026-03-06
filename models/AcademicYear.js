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
    startMonth: {
      type: Number,
      min: 1,
      max: 12
    },
    endMonth: {
      type: Number,
      min: 1,
      max: 12
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

  if (
    this.startMonth !== undefined &&
    (!Number.isInteger(this.startMonth) ||
      this.startMonth < 1 ||
      this.startMonth > 12)
  ) {
    throw new Error('startMonth must be an integer between 1 and 12');
  }

  if (
    this.endMonth !== undefined &&
    (!Number.isInteger(this.endMonth) ||
      this.endMonth < 1 ||
      this.endMonth > 12)
  ) {
    throw new Error('endMonth must be an integer between 1 and 12');
  }
});

export default mongoose.model('AcademicYear', academicYearSchema);
