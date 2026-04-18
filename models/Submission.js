import mongoose from 'mongoose';

const quizAnswerSchema = new mongoose.Schema(
  {
    questionIndex: {
      type: Number,
      required: true,
      min: 0
    },
    answers: {
      type: [String],
      default: []
    },
    textAnswer: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassroomPost',
      required: true,
      index: true
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      default: null,
      index: true
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      default: null,
      index: true
    },
    submissionType: {
      type: String,
      enum: ['assignment', 'quiz'],
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    attachments: [
      {
        fileUrl: String,
        fileName: String,
        fileType: String
      }
    ],
    textSubmission: {
      type: String,
      default: ''
    },
    linkSubmission: {
      type: String,
      default: ''
    },
    quizAnswers: {
      type: [quizAnswerSchema],
      default: []
    },
    marks: {
      type: Number,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'submitted', 'graded'],
      default: 'pending'
    },
    isLate: {
      type: Boolean,
      default: false
    },
    submittedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

submissionSchema.index({ postId: 1, studentId: 1 }, { unique: true });

export default mongoose.model('Submission', submissionSchema);
