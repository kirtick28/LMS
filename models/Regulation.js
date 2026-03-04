import mongoose from 'mongoose';

const regulationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },

    startYear: {
      type: Number,
      required: true,
      index: true,
      min: 1900
    },

    totalSemesters: {
      type: Number,
      default: 8,
      min: 1
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
regulationSchema.index({ startYear: 1, totalSemesters: 1 });

/* ---------------- MIDDLEWARE ---------------- */
regulationSchema.pre('validate', function () {
  if (!this.name && this.startYear) {
    this.name = `R${this.startYear}`;
  }

  if (this.name) {
    this.name = String(this.name).trim().toUpperCase();
  }
});

export default mongoose.model('Regulation', regulationSchema);
