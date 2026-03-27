import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassroomPost',
      required: true,
      unique: true
    },

    isQuiz: {
      type: Boolean,
      default: false
    },

    points: {
      type: Number,
      default: null
    },

    isUngraded: {
      type: Boolean,
      default: false
    },

    dueDate: {
      type: Date,
      default: null
    },

    submissionType: {
      type: String,
      enum: ['file', 'link', 'text', 'any'],
      default: 'any'
    },

    allowLateSubmission: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('Assignment', assignmentSchema);
