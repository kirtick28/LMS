import mongoose from 'mongoose';

const attendanceRequestSchema = new mongoose.Schema(
  {
    attendanceRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      required: true,
      index: true
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true
    },

    requestedChanges: [
      {
        student: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Student',
          required: true
        },
        previousStatus: {
          type: String,
          enum: ['Present', 'Absent', 'OnDuty'],
          required: true
        },
        newStatus: {
          type: String,
          enum: ['Present', 'Absent', 'OnDuty'],
          required: true
        }
      }
    ],

    reason: {
      type: String,
      required: true,
      trim: true
    },

    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index: true
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty'
    },
    reviewRemarks: {
      type: String,
      trim: true
    },
    resolvedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

const AttendanceRequest = mongoose.model(
  'AttendanceRequest',
  attendanceRequestSchema
);
export default AttendanceRequest;
