import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema(
  {
    startYear: {
      type: Number,
      required: true,
      index: true
    },
    endYear: {
      type: Number,
      required: true
    },
    programDuration: {
      type: Number,
      default: 4,
      min: 1
    },
    name: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

batchSchema.index({ startYear: 1, endYear: 1 }, { unique: true });

batchSchema.pre('validate', function () {
  if (!this.endYear && this.startYear && this.programDuration) {
    this.endYear = this.startYear + this.programDuration;
  }

  if (!this.name && this.startYear && this.endYear) {
    this.name = `${this.startYear}-${this.endYear}`;
  }

  if (this.startYear >= this.endYear) {
    throw new Error('endYear must be greater than startYear');
  }
});

export default mongoose.model('Batch', batchSchema);
