import mongoose from 'mongoose';
import CommentSchema from '../schemas/comment.js';

const StreamSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true
    },

    message: {
      type: String,
      required: true,
      trim: true
    },

    attachments: {
      type: [String],
      default: []
    },

    link: {
      type: String,
      default: ''
    },

    youtubeLink: {
      type: String,
      default: ''
    },

    comments: {
      type: [CommentSchema],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model('Stream', StreamSchema);
