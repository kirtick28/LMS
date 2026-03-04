import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },

    shortName: {
      type: String,
      trim: true
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
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

departmentSchema.pre('validate', function () {
  if (!this.code) {
    const source = this.shortName || this.name || '';
    this.code = String(source)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
  }
});

export default mongoose.model('Department', departmentSchema);
