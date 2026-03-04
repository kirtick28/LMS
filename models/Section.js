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

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

/* Prevent duplicate sections inside same batch & semester */
sectionSchema.index(
  { name: 1, batchId: 1, semesterNumber: 1 },
  { unique: true }
);

export default mongoose.model('Section', sectionSchema);
