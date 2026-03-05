import mongoose from 'mongoose';
import StudentAcademicRecord from '../models/StudentAcademicRecord.js';
import Student from '../models/Student.js';
import AcademicYear from '../models/AcademicYear.js';
import Section from '../models/Section.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createStudentAcademicRecord = async (req, res) => {
  try {
    const { studentId, academicYearId, semesterNumber, sectionId, status } =
      req.body;

    if (!studentId || !academicYearId || !semesterNumber || !sectionId) {
      return res.status(400).json({
        success: false,
        message:
          'studentId, academicYearId, semesterNumber, and sectionId are required',
        data: {}
      });
    }

    if (
      !isValidObjectId(studentId) ||
      !isValidObjectId(academicYearId) ||
      !isValidObjectId(sectionId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ObjectId provided',
        data: {}
      });
    }

    const [student, academicYear, section] = await Promise.all([
      Student.findById(studentId),
      AcademicYear.findById(academicYearId),
      Section.findById(sectionId)
    ]);

    if (!student || !academicYear || !section) {
      return res.status(404).json({
        success: false,
        message: 'Student, AcademicYear, or Section not found',
        data: {}
      });
    }

    const existing = await StudentAcademicRecord.findOne({
      studentId,
      academicYearId,
      semesterNumber
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          'Record already exists for this student in this semester and academic year',
        data: {}
      });
    }

    const record = await StudentAcademicRecord.create({
      studentId,
      academicYearId,
      semesterNumber,
      sectionId,
      status: status || 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Student Academic Record created successfully',
      data: { record }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getAllStudentAcademicRecords = async (req, res) => {
  try {
    const { studentId, academicYearId, sectionId, status } = req.query;
    const filter = {};

    if (studentId) {
      if (!isValidObjectId(studentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid studentId',
          data: {}
        });
      }
      filter.studentId = studentId;
    }

    if (academicYearId) {
      if (!isValidObjectId(academicYearId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid academicYearId',
          data: {}
        });
      }
      filter.academicYearId = academicYearId;
    }

    if (sectionId) {
      if (!isValidObjectId(sectionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sectionId',
          data: {}
        });
      }
      filter.sectionId = sectionId;
    }

    if (status) {
      filter.status = status;
    }

    const records = await StudentAcademicRecord.find(filter)
      .populate('studentId', 'firstName lastName registerNumber')
      .populate('academicYearId', 'name startYear endYear')
      .populate('sectionId', 'name')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Student Academic Records retrieved successfully',
      data: { records }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getStudentAcademicRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid record id',
        data: {}
      });
    }

    const record = await StudentAcademicRecord.findById(id)
      .populate('studentId', 'firstName lastName registerNumber')
      .populate('academicYearId', 'name startYear endYear')
      .populate('sectionId', 'name');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Student Academic Record not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Student Academic Record retrieved successfully',
      data: { record }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const updateStudentAcademicRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid record id',
        data: {}
      });
    }

    const current = await StudentAcademicRecord.findById(id);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Student Academic Record not found',
        data: {}
      });
    }

    const objectIdFields = ['studentId', 'academicYearId', 'sectionId'];
    for (const field of objectIdFields) {
      if (updates[field] && !isValidObjectId(updates[field])) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field}`,
          data: {}
        });
      }
    }

    const targetStudentId = updates.studentId || current.studentId;
    const targetAcademicYearId =
      updates.academicYearId || current.academicYearId;
    const targetSemesterNumber =
      updates.semesterNumber || current.semesterNumber;

    if (updates.studentId || updates.academicYearId || updates.semesterNumber) {
      const duplicate = await StudentAcademicRecord.findOne({
        _id: { $ne: id },
        studentId: targetStudentId,
        academicYearId: targetAcademicYearId,
        semesterNumber: targetSemesterNumber
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            'Record already exists for this student in this semester and academic year',
          data: {}
        });
      }
    }

    const record = await StudentAcademicRecord.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
      .populate('studentId', 'firstName lastName registerNumber')
      .populate('academicYearId', 'name startYear endYear')
      .populate('sectionId', 'name');

    return res.json({
      success: true,
      message: 'Student Academic Record updated successfully',
      data: { record }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const deleteStudentAcademicRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid record id',
        data: {}
      });
    }

    const record = await StudentAcademicRecord.findByIdAndDelete(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Student Academic Record not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Student Academic Record deleted successfully',
      data: {}
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};
