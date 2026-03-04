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
      trim: true
    },

    rollNumber: {
      type: String,
      trim: true
    },

    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: false
    },

    dateOfBirth: {
      type: Date,
      required: false
    },

    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      index: true
    },

    semesterNumber: {
      type: Number,
      min: 1,
      max: 12,
      default: 1,
      index: true
    },

    academicYearLabel: {
      type: String,
      trim: true,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
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

    academicHistory: [
      {
        academicYearId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'AcademicYear',
          required: true
        },
        semesterNumber: {
          type: Number,
          required: true
        },
        sectionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Section',
          required: true
        },
        isCurrent: {
          type: Boolean,
          default: false // Set to true when adding the active semester
        }
      }
    ]
  },
  { timestamps: true }
);

/* ---------------- COMPOUND INDEXES ---------------- */
studentSchema.index({ batchId: 1, academicStatus: 1 });
studentSchema.index({ departmentId: 1, academicStatus: 1 });
studentSchema.index({ sectionId: 1, semesterNumber: 1, isActive: 1 });

studentSchema.index({
  'academicHistory.sectionId': 1,
  'academicHistory.isCurrent': 1
});

/* ---------------- VIRTUALS ---------------- */
studentSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// A helpful virtual to instantly grab the student's current enrollment record
studentSchema.virtual('currentEnrollment').get(function () {
  return this.academicHistory.find((history) => history.isCurrent === true);
});

studentSchema.pre('validate', function () {
  const current = this.academicHistory.find((history) => history.isCurrent);

  if (current) {
    this.sectionId = this.sectionId || current.sectionId;
    this.semesterNumber = this.semesterNumber || current.semesterNumber;
  }

  if (this.academicStatus) {
    this.isActive = !['DISCONTINUED', 'DROPPED', 'GRADUATED'].includes(
      this.academicStatus
    );
  }
});

studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

export default mongoose.model('Student', studentSchema);
