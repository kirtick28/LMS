import mongoose from 'mongoose';

const facultySchema = new mongoose.Schema(
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

    salutation: {
      type: String,
      trim: true
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

    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9]{10}$/
    },

    employeeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },

    profileImage: {
      type: String,
      default: null
    },

    designation: {
      type: String,
      enum: [
        'Professor',
        'Assistant Professor',
        'Associate Professor',
        'HOD',
        'Dean',
        'Faculty',
        'Professor of Practice',
        'Lab Technician',
        'Department Secretary',
        'Senior Lab Technician',
        'ADMIN'
      ],
      required: true
    },

    qualification: {
      type: String,
      trim: true
    },

    workType: {
      type: String,
      trim: true
    },

    joiningDate: Date,

    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null
    },

    noticePeriod: {
      type: String,
      trim: true
    },

    employmentStatus: {
      type: String,
      enum: ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'RETIRED'],
      default: 'ACTIVE',
      index: true
    },

    documents: {
      marksheet: { type: String, default: null },
      experienceCertificate: { type: String, default: null },
      degreeCertificate: { type: String, default: null }
    }
  },
  { timestamps: true }
);

/* ---------------- INDEXES ---------------- */
facultySchema.index({ departmentId: 1, employmentStatus: 1 });

/* ---------------- VIRTUALS ---------------- */
facultySchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

facultySchema.set('toJSON', { virtuals: true });
facultySchema.set('toObject', { virtuals: true });

export default mongoose.model('Faculty', facultySchema);
