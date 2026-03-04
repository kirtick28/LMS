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
      trim: true
    },

    credits: {
      type: Number,
      default: 0,
      min: 0
    },

    courseType: {
      type: String,
      enum: ['T', 'P', 'TP', 'PJ', 'I'],
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
      default: null,
      index: true
    },

    regulation: {
      type: String,
      trim: true,
      index: true
    },

    type: {
      type: String,
      enum: ['T', 'P', 'TP', 'TPJ', 'PJ', 'I'],
      default: undefined
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
subjectSchema.index({ departmentId: 1, regulationId: 1, isActive: 1 });

subjectSchema.pre('validate', function () {
  if (!this.type && this.courseType) {
    this.type = this.courseType;
  }

  if (!this.courseType && this.type && this.type !== 'TPJ') {
    this.courseType = this.type;
  }
});

export default mongoose.model('Subject', subjectSchema);
