import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },

    program: {
      type: String,
      enum: ['B.E', 'B.Tech'],
      default: 'B.E',
      required: true
    },

    hodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null
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

/* ---------------- MIDDLEWARE ---------------- */
departmentSchema.pre('validate', function () {
  if (this.code) {
    this.code = String(this.code)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
  }
});

export default mongoose.model('Department', departmentSchema);
