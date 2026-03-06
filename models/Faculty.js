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
    primaryPhone: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9]{10}$/
    },
    secondaryPhone: {
      type: String,
      trim: true,
      match: /^[0-9]{10}$/,
      default: null
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    profileImage: {
      type: String,
      default: null
    },
    designation: {
      type: String,
      enum: [
        'Professor',
        'Associate Professor',
        'Assistant Professor',
        'HOD',
        'Dean',
        'Faculty',
        'Professor of Practice',
        'Lab Technician',
        'Senior Lab Technician',
        'Department Secretary'
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
    joiningDate: {
      type: Date
    },
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
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    isActive: {
      type: Boolean,
      default: true,
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

facultySchema.index({ departmentId: 1, employmentStatus: 1 });

facultySchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

facultySchema.pre('validate', function () {
  if (this.employmentStatus) {
    this.isActive = !['RESIGNED', 'RETIRED'].includes(this.employmentStatus);
    this.status = this.isActive ? 'active' : 'inactive';
  }
});

facultySchema.set('toJSON', { virtuals: true });
facultySchema.set('toObject', { virtuals: true });

export default mongoose.model('Faculty', facultySchema);
