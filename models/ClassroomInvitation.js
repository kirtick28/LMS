import mongoose from 'mongoose';

const classroomInvitationSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true
    },

    invitedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    invitedEmail: String, // for external invite

    role: {
      type: String,
      enum: ['faculty', 'student']
    },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

export default mongoose.model('ClassroomInvitation', classroomInvitationSchema);
