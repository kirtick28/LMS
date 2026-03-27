import mongoose from 'mongoose';

const quizSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassroomPost',
      required: true,
      unique: true
    },
    totalMarks: {
      type: Number,
      default: 0
    },
    dueDate: {
      type: Date,
      default: null
    },
    isAutoGraded: {
      type: Boolean,
      default: true
    },
    questions: [
      {
        questionText: {
          type: String,
          required: true,
          trim: true
        },
        questionType: {
          type: String,
          enum: ['single_choice', 'multiple_choice', 'short_answer'],
          required: true,
          default: 'single_choice'
        },
        options: [{ type: String, required: true }],
        correctAnswers: [{ type: String, required: true }],
        points: {
          type: Number,
          default: 1,
          min: 0
        }
      }
    ],
    allowLateSubmission: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

quizSchema.pre('save', function () {
  if (this.questions && this.questions.length > 0) {
    this.totalMarks = this.questions.reduce(
      (acc, q) => acc + (q.points || 0),
      0
    );
  } else {
    this.totalMarks = 0;
  }
});

export default mongoose.model('Quiz', quizSchema);
