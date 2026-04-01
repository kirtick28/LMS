import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const classroomSchema = new mongoose.Schema(
  {
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true
    },
    semesterNumber: {
      type: Number,
      required: true
    },
    name: String,
    status: {
      type: String,
      enum: ['active', 'unassigned', 'deprecated', 'archived'],
      default: 'active'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    joinCode: {
      type: String,
      unique: true,
      default: () => uuidv4().split('-')[0].toUpperCase()
    }
  },
  { timestamps: true }
);

classroomSchema.index(
  { sectionId: 1, subjectId: 1, academicYearId: 1, semesterNumber: 1 },
  { unique: true }
);

export default mongoose.model('Classroom', classroomSchema);
