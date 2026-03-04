import mongoose from 'mongoose';

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true
    },

    fileUrl: {
      type: String,
      default: ''
    },

    submittedAt: {
      type: Date,
      default: Date.now,
      index: true
    },

    marks: {
      type: Number,
      default: null,
      min: 0
    },

    feedback: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

assignmentSubmissionSchema.index(
  { assignmentId: 1, studentId: 1 },
  { unique: true }
);

export default mongoose.model(
  'AssignmentSubmission',
  assignmentSubmissionSchema
);
