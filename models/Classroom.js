import mongoose from 'mongoose';

const ClassroomSchema = new mongoose.Schema(
  {
    // 🔗 Link to teaching allocation
    facultyAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyAssignment',
      required: true,
      index: true
    },

    // 🔗 Academic Context (denormalized for fast queries)
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true
    },

    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
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
      required: true
    },

    // 🎓 Classroom Info
    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      trim: true
    },

    classCode: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // 👑 Control
    primaryFacultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true
    },

    // 📦 Status
    isActive: {
      type: Boolean,
      default: true
    },

    isArchived: {
      type: Boolean,
      default: false
    },

    archivedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Prevent duplicate classroom creation
ClassroomSchema.index(
  { subjectId: 1, sectionId: 1, academicYearId: 1, semesterNumber: 1 },
  { unique: true }
);

export default mongoose.model('Classroom', ClassroomSchema);
