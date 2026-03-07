import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    registerNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    rollNumber: {
      type: String,
      trim: true
    },
    entryType: {
      type: String,
      enum: ['REGULAR', 'LATERAL'],
      default: 'REGULAR'
    },
    status: {
      type: String,
      enum: ['active', 'graduated', 'dropped'],
      default: 'active',
      index: true
    },
    semesterNumber: {
      type: Number
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

studentSchema.index({ batchId: 1, status: 1 });
studentSchema.index({ departmentId: 1, status: 1 });
studentSchema.index({ sectionId: 1, isActive: 1 });

studentSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

studentSchema.pre('validate', function () {
  if (this.status) {
    this.isActive = !['graduated', 'dropped'].includes(this.status);
  }
});

studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

export default mongoose.model('Student', studentSchema);
