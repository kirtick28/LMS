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

    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other']
    },

    dateOfBirth: {
      type: Date
    },

    semesterNumber: {
      type: Number,
      min: 1,
      max: 12,
      default: 1,
      index: true
    },

    academicYear: {
      startYear: {
        type: Number,
        index: true
      },
      endYear: {
        type: Number,
        index: true
      },
      name: {
        type: String,
        trim: true,
        index: true
      }
    },

    entryType: {
      type: String,
      enum: ['REGULAR', 'LATERAL'],
      default: 'REGULAR'
    },

    academicStatus: {
      type: String,
      enum: ['ACTIVE', 'DISCONTINUED', 'DROPPED', 'GRADUATED', 'SUSPENDED'],
      default: 'ACTIVE',
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

/* ---------------- COMPOUND INDEXES ---------------- */
studentSchema.index({ batchId: 1, academicStatus: 1 });
studentSchema.index({ departmentId: 1, academicStatus: 1 });
studentSchema.index({ sectionId: 1, semesterNumber: 1, isActive: 1 });
studentSchema.index({
  batchId: 1,
  semesterNumber: 1,
  'academicYear.startYear': 1
});

/* ---------------- VIRTUALS ---------------- */
studentSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

/* ---------------- MIDDLEWARE ---------------- */
studentSchema.pre('validate', function () {
  if (this.academicStatus) {
    this.isActive = !['DISCONTINUED', 'DROPPED', 'GRADUATED'].includes(
      this.academicStatus
    );
  }
});

studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

export default mongoose.model('Student', studentSchema);
