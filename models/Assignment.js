import mongoose from 'mongoose';
import CommentSchema from '../schemas/comment.schema.js';

const assignmentSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: ''
    },

    dueDate: {
      type: Date,
      required: true,
      index: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true
    },

    marks: {
      type: Number,
      default: 0,
      min: 0
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
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

assignmentSchema.index({ classroomId: 1, dueDate: 1 });
assignmentSchema.index({ createdBy: 1, createdAt: -1 });

assignmentSchema.pre('validate', function () {
  if (this.dueDate && this.createdAt && this.dueDate < this.createdAt) {
    throw new Error('dueDate cannot be before creation time');
  }
});

export default mongoose.model('Assignment', assignmentSchema);
