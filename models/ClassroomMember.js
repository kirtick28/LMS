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
      required: true,
      index: true
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true
    },

    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null,
      index: true
    },

    role: {
      type: String,
      enum: ['student', 'faculty'],
      required: true,
      index: true
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
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

/* ---------------- INDEXES ---------------- */
classroomMemberSchema.index({ classroomId: 1, userId: 1 }, { unique: true });
classroomMemberSchema.index({ classroomId: 1, role: 1 });

/* ---------------- MIDDLEWARE ---------------- */
classroomMemberSchema.pre('validate', function () {
  if (this.role === 'student' && !this.studentId) {
    throw new Error('studentId is required when role is student');
  }

  if (this.role === 'faculty' && !this.facultyId) {
    throw new Error('facultyId is required when role is faculty');
  }
});

export default mongoose.model('ClassroomMember', classroomMemberSchema);
