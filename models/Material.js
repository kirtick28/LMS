import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassroomPost',
      required: true,
      unique: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('Material', materialSchema);
