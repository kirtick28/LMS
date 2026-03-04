import mongoose from 'mongoose';

const ClassroomInvitationSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true
    },

    role: {
      type: String,
      enum: ['student', 'faculty'],
      required: true
    },

    status: {
      type: String,
      enum: ['Pending', 'Accepted', 'Rejected', 'Expired'],
      default: 'Pending'
    },

    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    expiresAt: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('ClassroomInvitation', ClassroomInvitationSchema);
