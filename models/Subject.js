import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true
    },

    regulation: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    type: {
      type: String,
      enum: ['T', 'P', 'TP', 'TPJ', 'PJ', 'I'],
      required: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

/* Unique per regulation + department */
subjectSchema.index(
  { code: 1, regulation: 1, departmentId: 1 },
  { unique: true }
);

/* Fast filtering */
subjectSchema.index({
  departmentId: 1,
  regulation: 1,
  isActive: 1
});

export default mongoose.model('Subject', subjectSchema);
