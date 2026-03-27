import mongoose from 'mongoose';

const quizSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassroomPost',
      required: true,
      unique: true
    },

    duration: Number,

    totalMarks: Number,

    questions: [
      {
        question: String,
        options: [String],
        correctAnswer: Number
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model('Quiz', quizSchema);
