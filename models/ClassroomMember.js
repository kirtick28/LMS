import mongoose from 'mongoose';

const classroomMemberSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    role: {
      type: String,
      enum: ['FACULTY', 'STUDENT'],
      required: true
    },

    status: {
      type: String,
      enum: ['active', 'removed'],
      default: 'active'
    }
  },
  { timestamps: true }
);

// prevent duplicates
classroomMemberSchema.index(
  {
    classroomId: 1,
    userId: 1
  },
  { unique: true }
);

export default mongoose.model('ClassroomMember', classroomMemberSchema);
