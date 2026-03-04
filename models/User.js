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
      index: true
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },

    role: {
      type: String,
      enum: [
        'super_admin',
        'admin',
        'faculty',
        'student',
        'SUPER_ADMIN',
        'ADMIN',
        'FACULTY',
        'STUDENT'
      ],
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

    lastLogin: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date
  },
  { timestamps: true }
);

/* ---------------- INDEXES ---------------- */
userSchema.index({ email: 1, isActive: 1 });

/* ---------------- DOCUMENT MIDDLEWARE ---------------- */
// Check both profileRef and profileType exist together
userSchema.pre('save', async function () {
  if (this.role) {
    const role = String(this.role);
    const roleMap = {
      super_admin: 'SUPER_ADMIN',
      admin: 'ADMIN',
      faculty: 'FACULTY',
      student: 'STUDENT'
    };

    this.role = roleMap[role.toLowerCase()] || role;
  }

  if (this.profileRef && !this.profileType) {
    throw new Error('profileType is required when profileRef is provided');
  }

  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(process.env.NODE_ENV === 'test' ? 1 : 12);
  this.password = await bcrypt.hash(this.password, salt);
});
/* ---------------- INSTANCE METHODS ---------------- */
// Compare provided password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update the last login timestamp
userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

export default mongoose.model('User', userSchema);
