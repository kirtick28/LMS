import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    shortName: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
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
      required: true,
      index: true
    },

    courseCategory: {
      type: String,
      enum: [
        'Foundation',
        'Basic Science',
        'Engineering Science',
        'Professional Core',
        'Professional Elective',
        'Open Elective',
        'Mandatory',
        'Skill Enhancement',
        'Value Added',
        'Project',
        'Internship'
      ],
      required: true,
      index: true
    },

    deliveryType: {
      type: String,
      enum: ['T', 'P', 'TP', 'TPJ', 'PJ', 'I'],
      required: true
    },

    credits: {
      type: Number,
      default: 0,
      min: 0
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

subjectSchema.virtual('components', {
  ref: 'SubjectComponent',
  localField: '_id',
  foreignField: 'subjectId'
});

subjectSchema.set('toObject', { virtuals: true });
subjectSchema.set('toJSON', { virtuals: true });

subjectSchema.index(
  { departmentId: 1, regulationId: 1, code: 1 },
  { unique: true }
);

export default mongoose.model('Subject', subjectSchema);
