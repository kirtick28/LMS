import mongoose from 'mongoose';

const classroomInvitationSchema = new mongoose.Schema(
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
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending',
      index: true
    },
    token: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    expiresAt: {
      type: Date
    },
    acceptedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

classroomInvitationSchema.index({ classroomId: 1, studentId: 1, status: 1 });

classroomInvitationSchema.pre('validate', function () {
  if (this.status === 'accepted' && !this.acceptedAt) {
    this.acceptedAt = new Date();
  }
});

export default mongoose.model('ClassroomInvitation', classroomInvitationSchema);
