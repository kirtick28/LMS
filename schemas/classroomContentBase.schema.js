import mongoose from 'mongoose';
import CommentSchema from './comment.js';

const ClassroomContentBaseSchema = {
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

  title: {
    type: String,
    required: true,
    trim: true
  },

  instruction: {
    type: String,
    default: ''
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
};

export default ClassroomContentBaseSchema;
