import mongoose from 'mongoose';

const SubmissionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },

    attachment: String,

    selectedOptions: [String], // used only in MCQ (optional)

    marksObtained: {
      type: Number,
      default: null
    },

    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export default SubmissionSchema;
