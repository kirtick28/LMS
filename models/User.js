import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },

    role: {
      type: String,
      enum: ['ADMIN', 'FACULTY', 'STUDENT'],
      required: true,
      index: true
    },

    profileRef: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      refPath: 'profileType'
    },

    profileType: {
      type: String,
      required: false,
      enum: ['Student', 'Faculty']
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: false
    },

    dateOfBirth: {
      type: Date,
      required: false
    },

    lastLogin: {
      type: Date
    },

    resetPasswordToken: {
      type: String,
      select: false,
      sparse: true
    },

    resetPasswordExpire: {
      type: Date,
      select: false,
      index: true
    }
  },
  { timestamps: true }
);

/* ---------------- INDEXES ---------------- */
userSchema.index({ email: 1, isActive: 1 });

/* ---------------- DOCUMENT MIDDLEWARE ---------------- */
userSchema.pre('save', async function () {
  if (this.role) {
    const role = String(this.role);
    const roleMap = {
      admin: 'ADMIN',
      faculty: 'FACULTY',
      student: 'STUDENT'
    };

    this.role = roleMap[role.toLowerCase()] || role;
  }

  if (this.profileRef && !this.profileType) {
    throw new Error('profileType is required when profileRef is provided');
  }

  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(process.env.NODE_ENV === 'test' ? 1 : 12);
  this.password = await bcrypt.hash(this.password, salt);
});

/* ---------------- INSTANCE METHODS ---------------- */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

export default mongoose.model('User', userSchema);
