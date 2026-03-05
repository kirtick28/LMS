import mongoose from 'mongoose';
import FacultyAssignment from '../models/FacultyAssignment.js';
import Faculty from '../models/Faculty.js';
import Section from '../models/Section.js';
import Subject from '../models/Subject.js';
import AcademicYear from '../models/AcademicYear.js';
import Curriculum from '../models/Curriculum.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createFacultyAssignment = async (req, res) => {
  try {
    const { facultyId, sectionId, subjectId, academicYearId, semesterNumber } =
      req.body;

    if (
      !facultyId ||
      !sectionId ||
      !subjectId ||
      !academicYearId ||
      !semesterNumber
    ) {
      return res.status(400).json({
        success: false,
        message:
          'facultyId, sectionId, subjectId, academicYearId, and semesterNumber are required',
        data: {}
      });
    }

    if (
      !isValidObjectId(facultyId) ||
      !isValidObjectId(sectionId) ||
      !isValidObjectId(subjectId) ||
      !isValidObjectId(academicYearId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ObjectId provided',
        data: {}
      });
    }

    const [faculty, section, subject, academicYear] = await Promise.all([
      Faculty.findById(facultyId),
      Section.findById(sectionId).populate('batchProgramId'),
      Subject.findById(subjectId),
      AcademicYear.findById(academicYearId)
    ]);

    if (!faculty || !section || !subject || !academicYear) {
      return res.status(404).json({
        success: false,
        message:
          'Referenced Faculty, Section, Subject, or AcademicYear not found',
        data: {}
      });
    }

    const batchProgram = section.batchProgramId;

    if (!batchProgram) {
      return res.status(400).json({
        success: false,
        message: 'Section is not properly mapped to a BatchProgram',
        data: {}
      });
    }

    const curriculum = await Curriculum.findOne({
      departmentId: batchProgram.departmentId,
      regulationId: batchProgram.regulationId,
      'semesters.semesterNumber': semesterNumber,
      'semesters.subjects': subjectId
    });

    if (!curriculum) {
      return res.status(400).json({
        success: false,
        message:
          'This subject is not part of the curriculum for this department, regulation, and semester',
        data: {}
      });
    }

    const existing = await FacultyAssignment.findOne({
      sectionId,
      subjectId,
      academicYearId,
      semesterNumber,
      status: 'active'
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          'A faculty member is already assigned to this subject for this section in this academic year',
        data: {}
      });
    }

    const assignment = await FacultyAssignment.create({
      facultyId,
      sectionId,
      subjectId,
      academicYearId,
      semesterNumber,
      assignedBy: req.user?._id || null,
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Faculty Assignment created successfully',
      data: { assignment }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getAllFacultyAssignments = async (req, res) => {
  try {
    const { facultyId, sectionId, academicYearId, status } = req.query;
    const filter = {};

    if (facultyId) {
      if (!isValidObjectId(facultyId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid facultyId',
          data: {}
        });
      }
      filter.facultyId = facultyId;
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

    if (status) {
      filter.status = status;
    }

    const assignments = await FacultyAssignment.find(filter)
      .populate('facultyId', 'firstName lastName employeeId')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code courseType credits')
      .populate('academicYearId', 'name')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Faculty Assignments retrieved successfully',
      data: { assignments }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getFacultyAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignment id',
        data: {}
      });
    }

    const assignment = await FacultyAssignment.findById(id)
      .populate('facultyId', 'firstName lastName employeeId')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code courseType credits')
      .populate('academicYearId', 'name');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Faculty Assignment not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Faculty Assignment retrieved successfully',
      data: { assignment }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const updateFacultyAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignment id',
        data: {}
      });
    }

    const current = await FacultyAssignment.findById(id);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Faculty Assignment not found',
        data: {}
      });
    }

    const objectIdFields = [
      'facultyId',
      'sectionId',
      'subjectId',
      'academicYearId'
    ];
    for (const field of objectIdFields) {
      if (updates[field] && !isValidObjectId(updates[field])) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field}`,
          data: {}
        });
      }
    }

    if (
      updates.sectionId ||
      updates.subjectId ||
      updates.academicYearId ||
      updates.semesterNumber
    ) {
      const targetSectionId = updates.sectionId || current.sectionId;
      const targetSubjectId = updates.subjectId || current.subjectId;
      const targetAcademicYearId =
        updates.academicYearId || current.academicYearId;
      const targetSemesterNumber =
        updates.semesterNumber || current.semesterNumber;

      const duplicate = await FacultyAssignment.findOne({
        _id: { $ne: id },
        sectionId: targetSectionId,
        subjectId: targetSubjectId,
        academicYearId: targetAcademicYearId,
        semesterNumber: targetSemesterNumber,
        status: 'active'
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            'A faculty member is already assigned to this subject for this section in this academic year',
          data: {}
        });
      }
    }

    const assignment = await FacultyAssignment.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
      .populate('facultyId', 'firstName lastName employeeId')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code courseType credits')
      .populate('academicYearId', 'name');

    return res.json({
      success: true,
      message: 'Faculty Assignment updated successfully',
      data: { assignment }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const deleteFacultyAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignment id',
        data: {}
      });
    }

    const assignment = await FacultyAssignment.findByIdAndDelete(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Faculty Assignment not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Faculty Assignment deleted successfully',
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
