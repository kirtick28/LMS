import mongoose from 'mongoose';

const classroomPostSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    createdByRole: {
      type: String,
      enum: ['STUDENT', 'FACULTY'],
      required: true
    },

    type: {
      type: String,
      enum: ['announcement', 'assignment', 'quiz', 'question', 'material'],
      required: true
    },

    title: {
      type: String,
      trim: true
    },

    instructions: {
      type: String
    },

    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      default: null
    },

    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String
      }
    ],

    isPublished: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('ClassroomPost', classroomPostSchema);
