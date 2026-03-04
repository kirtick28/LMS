import mongoose from 'mongoose';
import ClassroomContentBaseSchema from '../schemas/classroomContentBase.js';

const MaterialSchema = new mongoose.Schema(
  {
    ...ClassroomContentBaseSchema
  },
  { timestamps: true }
);

export default mongoose.model('Material', MaterialSchema);
