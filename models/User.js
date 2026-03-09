import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const getSaltRounds = () => {
  if (process.env.NODE_ENV === 'test') return 1;

  const fromEnv = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '', 10);
  if (Number.isInteger(fromEnv) && fromEnv >= 4 && fromEnv <= 15) {
    return fromEnv;
  }

  return process.env.NODE_ENV === 'development' ? 10 : 12;
};

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

userSchema.index({ email: 1, isActive: 1 });

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

  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(getSaltRounds());
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

export default mongoose.model('User', userSchema);
