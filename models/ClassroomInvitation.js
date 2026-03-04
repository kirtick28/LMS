import mongoose from 'mongoose';

const classroomInvitationSchema = new mongoose.Schema(
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
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true
    },

    role: {
      type: String,
      enum: ['student', 'faculty'],
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
      required: true,
      unique: true,
      index: true
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true
    },

    acceptedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

/* ---------------- INDEXES ---------------- */
classroomInvitationSchema.index({ classroomId: 1, email: 1, status: 1 });

/* ---------------- MIDDLEWARE ---------------- */
classroomInvitationSchema.pre('validate', function () {
  if (this.status === 'accepted' && !this.acceptedAt) {
    this.acceptedAt = new Date();
  }
});

export default mongoose.model('ClassroomInvitation', classroomInvitationSchema);
