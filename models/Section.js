import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true
    },

    capacity: {
      type: Number,
      default: 60,
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
sectionSchema.index({ name: 1, batchId: 1 }, { unique: true });
sectionSchema.index({ batchId: 1, isActive: 1 });

/* ---------------- MIDDLEWARE ---------------- */
sectionSchema.pre('validate', function () {
  if (this.name) {
    this.name = String(this.name).trim().toUpperCase();
  }
});

export default mongoose.model('Section', sectionSchema);
