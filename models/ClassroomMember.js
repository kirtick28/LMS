import mongoose from 'mongoose';

const classroomMemberSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['student', 'rep'],
      default: 'student',
      index: true
    },
    joinMethod: {
      type: String,
      enum: ['auto', 'invite', 'self'],
      default: 'auto'
    },
    status: {
      type: String,
      enum: ['active', 'removed'],
      default: 'active',
      index: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

classroomMemberSchema.index({ classroomId: 1, studentId: 1 }, { unique: true });

export default mongoose.model('ClassroomMember', classroomMemberSchema);
