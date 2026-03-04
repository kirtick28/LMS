import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true
    },

    admissionYear: {
      type: Number,
      required: true,
      index: true
    },

    graduationYear: {
      type: Number,
      required: true
    },

    programDuration: {
      type: Number,
      default: 4
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
batchSchema.pre('validate', function () {
  if (this.admissionYear >= this.graduationYear) {
    throw new Error('graduationYear must be greater than admissionYear');
  }
});

export default mongoose.model('Batch', batchSchema);
