import mongoose from 'mongoose';

const batchProgramSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true
    },
    regulationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Regulation',
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

batchProgramSchema.index({ batchId: 1, departmentId: 1 }, { unique: true });

export default mongoose.model('BatchProgram', batchProgramSchema);
