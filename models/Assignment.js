import mongoose from 'mongoose';
import ClassroomContentBaseSchema from '../schemas/classroomContentBase.js';
import SubmissionSchema from '../schemas/submission.js';

const AssignmentSchema = new mongoose.Schema(
  {
    ...ClassroomContentBaseSchema,

    marks: {
      type: Number,
      required: true
    },

    dueDate: {
      type: Date,
      required: true
    },

    submissions: {
      type: [SubmissionSchema],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model('Assignment', AssignmentSchema);
