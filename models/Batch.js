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

    regulationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Regulation',
      default: null,
      index: true
    },

    startYear: {
      type: Number,
      index: true
    },

    endYear: {
      type: Number
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

batchSchema.index(
  { departmentId: 1, startYear: 1, endYear: 1 },
  { unique: true, sparse: true }
);

batchSchema.index(
  { departmentId: 1, admissionYear: 1, graduationYear: 1 },
  { unique: true }
);

/* ---------------- VALIDATION ---------------- */
batchSchema.pre('validate', function () {
  if (!this.startYear && this.admissionYear) {
    this.startYear = this.admissionYear;
  }

  if (!this.endYear && this.graduationYear) {
    this.endYear = this.graduationYear;
  }

  if (!this.admissionYear && this.startYear) {
    this.admissionYear = this.startYear;
  }

  if (!this.graduationYear && this.endYear) {
    this.graduationYear = this.endYear;
  }

  if (!this.graduationYear && this.admissionYear && this.programDuration) {
    this.graduationYear = this.admissionYear + this.programDuration;
  }

  if (!this.endYear && this.startYear && this.programDuration) {
    this.endYear = this.startYear + this.programDuration;
  }

  if (!this.name && this.startYear && this.endYear) {
    this.name = `${this.startYear}-${this.endYear}`;
  }

  if (this.admissionYear >= this.graduationYear) {
    throw new Error('graduationYear must be greater than admissionYear');
  }
});

export default mongoose.model('Batch', batchSchema);
