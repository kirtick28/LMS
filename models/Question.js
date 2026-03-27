import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassroomPost',
      required: true,
      unique: true
    },

    questionType: {
      type: String,
      enum: ['short_answer', 'multiple_choice'],
      required: true
    },

    options: [String],

    allowStudentReply: {
      type: Boolean,
      default: true
    },

    points: {
      type: Number,
      default: null
    },

    isUngraded: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('Question', questionSchema);
