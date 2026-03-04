import mongoose from 'mongoose';

const ClassroomMemberSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userModel'
    },

    userModel: {
      type: String,
      required: true,
      enum: ['Student', 'Faculty']
    },

    role: {
      type: String,
      enum: ['student', 'faculty'],
      required: true
    },

    facultyAccessLevel: {
      type: String,
      enum: ['PRIMARY', 'SECONDARY'],
      default: null
    },

    joinMethod: {
      type: String,
      enum: ['auto', 'invite', 'self'],
      required: true
    }
  },
  { timestamps: true }
);

// Prevent duplicate membership
ClassroomMemberSchema.index({ classroomId: 1, userId: 1 }, { unique: true });

export default mongoose.model('ClassroomMember', ClassroomMemberSchema);
