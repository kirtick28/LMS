import mongoose from 'mongoose';
import Section from '../models/Section.js';
import Student from '../models/Student.js';
import BatchProgram from '../models/BatchProgram.js';
import Batch from '../models/Batch.js';
import AcademicYear from '../models/AcademicYear.js';
import StudentAcademicRecord from '../models/StudentAcademicRecord.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const populateConfig = {
  path: 'batchProgramId',
  populate: [
    { path: 'batchId', select: 'name startYear endYear' },
    { path: 'departmentId', select: 'name code' },
    { path: 'regulationId', select: 'name startYear' }
  ]
};

export const createSection = async (req, res, next) => {
  try {
    const { name, batchProgramId, capacity, isActive } = req.body;

    if (!name || !batchProgramId) {
      return res.status(400).json({
        success: false,
        message: 'name and batchProgramId are required',
        data: {}
      });
    }

    if (!isValidObjectId(batchProgramId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batchProgramId',
        data: {}
      });
    }

    const batchProgram = await BatchProgram.findById(batchProgramId);

    if (!batchProgram) {
      return res.status(404).json({
        success: false,
        message: 'BatchProgram not found',
        data: {}
      });
    }

    const normalizedName = String(name).trim().toUpperCase();

    const existing = await Section.findOne({
      name: normalizedName,
      batchProgramId
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Section already exists for this BatchProgram',
        data: {}
      });
    }

    const section = await Section.create({
      name: normalizedName,
      batchProgramId,
      capacity,
      isActive
    });

    return res.status(201).json({
      success: true,
      message: 'Section created successfully',
      data: { section }
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllSections = async (req, res, next) => {
  try {
    const { batchProgramId, isActive } = req.query;

    const filter = {};

    if (batchProgramId) {
      if (!isValidObjectId(batchProgramId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid batchProgramId',
          data: {}
        });
      }
      filter.batchProgramId = batchProgramId;
    }

    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const sections = await Section.find(filter)
      .populate(populateConfig)
      .sort({ name: 1 })
      .lean();

    const academicYear = await AcademicYear.findOne({ isActive: true });

    const counts = await StudentAcademicRecord.aggregate([
      {
        $match: {
          academicYearId: academicYear._id
        }
      },
      {
        $group: {
          _id: '$sectionId',
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = {};

    counts.forEach((c) => {
      countMap[c._id.toString()] = c.count;
    });

    const sectionsWithCount = sections.map((section) => ({
      ...section,
      studentCount: countMap[section._id.toString()] || 0
    }));

    return res.json({
      success: true,
      message: 'Sections retrieved successfully',
      data: { sections: sectionsWithCount }
    });
  } catch (error) {
    return next(error);
  }
};

export const getSectionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section id',
        data: {}
      });
    }

    const section = await Section.findById(id).populate(populateConfig).lean();

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
        data: {}
      });
    }

    const academicYear = await AcademicYear.findOne({ isActive: true });

    const studentCount = await StudentAcademicRecord.countDocuments({
      sectionId: id,
      academicYearId: academicYear._id
    });

    section.studentCount = studentCount;

    return res.json({
      success: true,
      message: 'Section retrieved successfully',
      data: { section }
    });
  } catch (error) {
    return next(error);
  }
};

export const updateSection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section id',
        data: {}
      });
    }

    if (updates.batchProgramId && !isValidObjectId(updates.batchProgramId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batchProgramId',
        data: {}
      });
    }

    if (updates.name) {
      updates.name = String(updates.name).trim().toUpperCase();
    }

    const current = await Section.findById(id);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
        data: {}
      });
    }

    if (updates.batchProgramId) {
      const batchProgram = await BatchProgram.findById(updates.batchProgramId);
      if (!batchProgram) {
        return res.status(404).json({
          success: false,
          message: 'BatchProgram not found',
          data: {}
        });
      }
    }

    const targetName = updates.name || current.name;
    const targetBatchProgramId =
      updates.batchProgramId || current.batchProgramId;

    if (updates.name || updates.batchProgramId) {
      const duplicate = await Section.findOne({
        _id: { $ne: id },
        name: targetName,
        batchProgramId: targetBatchProgramId
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Section already exists for this BatchProgram',
          data: {}
        });
      }
    }

    const section = await Section.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    }).populate(populateConfig);

    return res.json({
      success: true,
      message: 'Section updated successfully',
      data: { section }
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteSection = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section id',
        data: {}
      });
    }

    const section = await Section.findByIdAndDelete(id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Section deleted successfully',
      data: {}
    });
  } catch (error) {
    return next(error);
  }
};

export const getCurrentYearsSections = async (req, res, next) => {
  try {
    const departmentId = req.user.departmentId;

    const academicYear = await AcademicYear.findOne({ isActive: true });

    if (!academicYear) {
      return res.status(404).json({
        success: false,
        message: 'Active academic year not found',
        data: {}
      });
    }

    const currentYear = academicYear.startYear;

    const batches = await Batch.find({
      startYear: { $lte: currentYear },
      endYear: { $gt: currentYear }
    }).lean();

    const batchIds = batches.map((b) => b._id);

    const batchPrograms = await BatchProgram.find({
      departmentId,
      batchId: { $in: batchIds }
    })
      .populate('batchId')
      .lean();

    const batchProgramIds = batchPrograms.map((bp) => bp._id);

    const sections = await Section.find({
      batchProgramId: { $in: batchProgramIds }
    })
      .sort({ name: 1 })
      .lean();

    const counts = await StudentAcademicRecord.aggregate([
      {
        $match: {
          academicYearId: academicYear._id,
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$sectionId',
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = {};

    counts.forEach((c) => {
      countMap[c._id.toString()] = c.count;
    });

    const result = batchPrograms.map((bp) => {
      const year = currentYear - bp.batchId.startYear + 1;

      const bpSections = sections
        .filter((s) => s.batchProgramId.toString() === bp._id.toString())
        .map((s) => ({
          ...s,
          studentCount: countMap[s._id.toString()] || 0
        }));

      return {
        year,
        batchProgramId: bp._id,
        batch: bp.batchId,
        sections: bpSections
      };
    });

    result.sort((a, b) => a.year - b.year);

    return res.json({
      success: true,
      message: 'Current years sections retrieved successfully',
      data: { years: result }
    });
  } catch (error) {
    return next(error);
  }
};

export const moveStudents = async (req, res, next) => {
  try {
    const { studentIds, targetSectionId } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'studentIds must be a non empty array',
        data: {}
      });
    }

    if (!isValidObjectId(targetSectionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid targetSectionId',
        data: {}
      });
    }

    const academicYear = await AcademicYear.findOne({ isActive: true });

    if (!academicYear) {
      return res.status(404).json({
        success: false,
        message: 'Active academic year not found',
        data: {}
      });
    }

    await Student.updateMany(
      { _id: { $in: studentIds } },
      { $set: { sectionId: targetSectionId } }
    );

    await StudentAcademicRecord.updateMany(
      {
        studentId: { $in: studentIds },
        academicYearId: academicYear._id
      },
      { $set: { sectionId: targetSectionId } }
    );

    return res.json({
      success: true,
      message: 'Students moved successfully',
      data: {}
    });
  } catch (error) {
    return next(error);
  }
};
