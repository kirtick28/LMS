import mongoose from 'mongoose';
import crypto from 'crypto';

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

    invitedEmail: {
      type: String
    },

    role: {
      type: String,
      enum: ['FACULTY', 'STUDENT']
    },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    token: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(32).toString('hex')
    },
    expiresAt: {
      type: Date,
      default: () => Date.now() + 24 * 60 * 60 * 1000
    }
  },
  { timestamps: true }
);

export default mongoose.model('ClassroomInvitation', classroomInvitationSchema);
