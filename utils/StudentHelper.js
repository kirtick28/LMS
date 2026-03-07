import mongoose from 'mongoose';
import Department from '../models/Department.js';
import Batch from '../models/Batch.js';
import BatchProgram from '../models/BatchProgram.js';
import Section from '../models/Section.js';
import AcademicYear from '../models/AcademicYear.js';
import AppError from './AppError.js'; // Adjust path if AppError is in a different directory relative to this file

class StudentHelper {
  static toObjectId(value, field) {
    if (!value) return null;
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new AppError(`Invalid ${field} format`, 400);
    }
    return new mongoose.Types.ObjectId(value);
  }

  static mapToAppError(error) {
    if (error instanceof AppError) return error;
    if (error.code === 11000)
      return new AppError('Duplicate record found', 400);
    return new AppError(error.message || 'Internal Server Error', 500);
  }

  static async getActiveAcademicYear() {
    const academicYear = await AcademicYear.findOne({ isActive: true });
    if (!academicYear) {
      throw new AppError('No active academic year configured', 400);
    }
    return academicYear;
  }

  static async resolveContext(departmentId, batchId, sectionId) {
    if (!departmentId || !batchId) {
      throw new AppError('departmentId and batchId are required', 400);
    }

    const department = await Department.findById(departmentId);
    if (!department) throw new AppError('Department not found', 404);

    const batch = await Batch.findById(batchId);
    if (!batch) throw new AppError('Batch not found', 404);

    const batchProgram = await BatchProgram.findOne({ departmentId, batchId });
    if (!batchProgram) {
      throw new AppError(
        'BatchProgram not found for the given Department and Batch',
        404
      );
    }

    let section;
    if (sectionId) {
      section = await Section.findOne({
        _id: sectionId,
        batchProgramId: batchProgram._id
      });
      if (!section)
        throw new AppError('Section not found within this BatchProgram', 404);
    } else {
      section = await Section.findOne({
        name: 'UNALLOCATED',
        batchProgramId: batchProgram._id
      });
      if (!section)
        throw new AppError(
          'UNALLOCATED section not found. Please create it first or provide a sectionId',
          404
        );
    }

    return { department, batch, batchProgram, section };
  }
}

export default StudentHelper;
