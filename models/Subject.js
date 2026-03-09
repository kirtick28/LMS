import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    credits: {
      type: Number,
      default: 0,
      min: 0
    },
    courseType: {
      type: String,
      enum: ['T', 'P', 'TP', 'TPJ', 'PJ', 'I'],
      default: 'T'
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true
    },
    regulationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Regulation',
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

subjectSchema.index({ departmentId: 1, isActive: 1 });
subjectSchema.index({ departmentId: 1, code: 1 }, { unique: true });
subjectSchema.index(
  { departmentId: 1, regulationId: 1, code: 1 },
  { unique: true }
);

export default mongoose.model('Subject', subjectSchema);
