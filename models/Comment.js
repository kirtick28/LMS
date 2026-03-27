import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassroomPost',
      required: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    message: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('Comment', commentSchema);
