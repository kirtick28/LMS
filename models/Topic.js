import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    isDefault: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

export default mongoose.model('Topic', topicSchema);
