import mongoose from 'mongoose';

const classroomSchema = new mongoose.Schema(
  {
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },

    subjectComponentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubjectComponent',
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

    name: String, // optional (ex: "DSA Lab - A")

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
    }
  },
  { timestamps: true }
);

// UNIQUE CLASSROOM
classroomSchema.index(
  {
    sectionId: 1,
    subjectComponentId: 1,
    academicYearId: 1,
    semesterNumber: 1
  },
  { unique: true }
);

export default mongoose.model('Classroom', classroomSchema);
