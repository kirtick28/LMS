import mongoose from 'mongoose';

const subjectComponentSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    shortName: {
      type: String,
      uppercase: true,
      trim: true
    },

    componentType: {
      type: String,
      enum: ['THEORY', 'PRACTICAL', 'PROJECT', 'INTERNSHIP'],
      required: true
    },

    hours: {
      type: Number,
      required: true,
      min: 0
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

subjectComponentSchema.index(
  { subjectId: 1, componentType: 1 },
  { unique: true }
);

export default mongoose.model('SubjectComponent', subjectComponentSchema);
