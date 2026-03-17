import mongoose from 'mongoose';

const facultyAssignmentSchema = new mongoose.Schema(
  {
    facultyIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Faculty',
        required: true
      }
    ],

    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },

    subjectComponentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubjectComponent',
      required: true,
      index: true
    },

    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
      index: true
    },

    semesterNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true
    },

    venue: { type: String, default: '' },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    status: {
      type: String,
      enum: ['active', 'removed'],
      default: 'active',
      index: true
    }
  },
  { timestamps: true }
);

facultyAssignmentSchema.index(
  {
    subjectComponentId: 1,
    sectionId: 1,
    academicYearId: 1,
    semesterNumber: 1
  },
  { unique: true }
);

export default mongoose.model('FacultyAssignment', facultyAssignmentSchema);
