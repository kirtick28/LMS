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

    // 🌟 The Updated History Array (Replaces Section ID)
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

// Indexing inside the array to quickly find students in a specific current section
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

studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

/* ---------------- DOCUMENT MIDDLEWARE ---------------- */
// Add logic here if you want to automatically set initial history on creation

export default mongoose.model('Student', studentSchema);
