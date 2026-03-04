import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userModel'
    },

    userModel: {
      type: String,
      enum: ['Student', 'Faculty'],
      required: true
    },

    comment: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: true }
);

export default CommentSchema;
