import mongoose from 'mongoose';

const regulationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },

    startYear: {
      type: Number,
      required: true,
      index: true
    },

    totalSemesters: {
      type: Number,
      default: 8,
      min: 1
    }
  },
  { timestamps: true }
);

regulationSchema.index({ startYear: 1, totalSemesters: 1 });

regulationSchema.pre('validate', function () {
  if (!this.name && this.startYear) {
    this.name = `R${this.startYear}`;
  }
});

export default mongoose.model('Regulation', regulationSchema);
