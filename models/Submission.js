import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    attachments: [
      {
        fileUrl: String,
        fileName: String
      }
    ],

    marks: {
      type: Number,
      default: null
    },

    status: {
      type: String,
      enum: ['pending', 'submitted', 'graded'],
      default: 'pending'
    },

    submittedAt: Date
  },
  { timestamps: true }
);

export default mongoose.model('Submission', submissionSchema);
