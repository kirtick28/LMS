import mongoose from 'mongoose';

const academicYearSchema = new mongoose.Schema(
  {
    name: {
      type: String, // "2024-2025"
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

    isCurrent: {
      type: Boolean,
      default: false
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

/* ---------------- VALIDATION ---------------- */
academicYearSchema.pre('validate', function () {
  if (this.startYear >= this.endYear) {
    throw new Error('endYear must be greater than startYear');
  }
});

/* ---------------- ENSURE SINGLE CURRENT YEAR ---------------- */
academicYearSchema.pre('save', async function () {
  if (this.isCurrent) {
    await mongoose
      .model('AcademicYear')
      .updateMany(
        { _id: { $ne: this._id }, isActive: true },
        { isCurrent: false }
      );
  }
});

/* ---------------- UNIQUE CURRENT INDEX ---------------- */
academicYearSchema.index(
  { isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);

export default mongoose.model('AcademicYear', academicYearSchema);
