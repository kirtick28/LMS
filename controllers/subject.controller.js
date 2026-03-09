import mongoose from 'mongoose';
import Subject from '../models/Subject.js';
import Department from '../models/Department.js';
import Regulation from '../models/Regulation.js';
import xlsx from 'xlsx';
import AppError from '../utils/AppError.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createSubject = async (req, res, next) => {
  try {
    const {
      name,
      code,
      credits,
      courseType,
      departmentId,
      regulationId,
      isActive
    } = req.body;

    if (!name || !code || !departmentId || !regulationId) {
      return res.status(400).json({
        success: false,
        message: 'name, code, departmentId and regulationId are required',
        data: {}
      });
    }

    if (!isValidObjectId(departmentId) || !isValidObjectId(regulationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid departmentId or regulationId',
        data: {}
      });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department not found',
        data: {}
      });
    }

    const regulation = await Regulation.findById(regulationId);
    if (!regulation) {
      return res.status(400).json({
        success: false,
        message: 'Regulation not found',
        data: {}
      });
    }

    const normalizedName = String(name).trim();
    const normalizedCode = String(code).toUpperCase().trim();

    const duplicate = await Subject.findOne({
      departmentId,
      regulationId,
      $or: [{ code: normalizedCode }, { name: normalizedName }]
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          'Subject with same code or name already exists in this regulation',
        data: {}
      });
    }

    const subject = await Subject.create({
      name: normalizedName,
      code: normalizedCode,
      credits,
      courseType,
      departmentId,
      regulationId,
      isActive
    });

    const populated = await Subject.findById(subject._id)
      .populate('departmentId', 'name code program')
      .populate('regulationId', 'name startYear');

    return res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: { subject: populated }
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(
        new AppError('Subject code already exists in this regulation', 409)
      );
    }

    return next(error);
  }
};

export const getAllSubjects = async (req, res, next) => {
  try {
    const { departmentId, regulationId, courseType, isActive } = req.query;

    const filter = {};

    if (departmentId) {
      if (!isValidObjectId(departmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid departmentId',
          data: {}
        });
      }
      filter.departmentId = departmentId;
    }

    if (regulationId) {
      if (!isValidObjectId(regulationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid regulationId',
          data: {}
        });
      }
      filter.regulationId = regulationId;
    }

    if (courseType) {
      filter.courseType = String(courseType).toUpperCase().trim();
    }

    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const subjects = await Subject.find(filter)
      .populate('departmentId', 'name code program')
      .populate('regulationId', 'name startYear')
      .sort({ code: 1 });

    return res.json({
      success: true,
      message: 'Subjects retrieved successfully',
      data: { subjects }
    });
  } catch (error) {
    return next(error);
  }
};

export const getSubjectById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject id',
        data: {}
      });
    }

    const subject = await Subject.findById(id)
      .populate('departmentId', 'name code program')
      .populate('regulationId', 'name startYear');

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Subject retrieved successfully',
      data: { subject }
    });
  } catch (error) {
    return next(error);
  }
};

export const updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject id',
        data: {}
      });
    }

    const current = await Subject.findById(id);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found',
        data: {}
      });
    }

    if (updates.name !== undefined) updates.name = String(updates.name).trim();

    if (updates.code !== undefined)
      updates.code = String(updates.code).toUpperCase().trim();

    const targetDepartmentId = updates.departmentId || current.departmentId;
    const targetRegulationId = updates.regulationId || current.regulationId;
    const targetName = updates.name || current.name;
    const targetCode = updates.code || current.code;

    const duplicate = await Subject.findOne({
      _id: { $ne: id },
      departmentId: targetDepartmentId,
      regulationId: targetRegulationId,
      $or: [{ code: targetCode }, { name: targetName }]
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          'Subject with same name or code already exists in this regulation',
        data: {}
      });
    }

    const subject = await Subject.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
      .populate('departmentId', 'name code program')
      .populate('regulationId', 'name startYear');

    return res.json({
      success: true,
      message: 'Subject updated successfully',
      data: { subject }
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('Subject code already exists', 409));
    }

    return next(error);
  }
};

export const deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject id',
        data: {}
      });
    }

    const subject = await Subject.findByIdAndDelete(id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Subject deleted successfully',
      data: { subject }
    });
  } catch (error) {
    return next(error);
  }
};

export const uploadMultipleSubjects = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        data: {}
      });
    }

    const departmentId = req.params.departmentId || req.body.departmentId;

    if (!departmentId || !isValidObjectId(departmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid departmentId required',
        data: {}
      });
    }

    const department = await Department.findById(departmentId);

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department not found',
        data: {}
      });
    }

    const workbook = req.file.buffer
      ? xlsx.read(req.file.buffer, { type: 'buffer' })
      : xlsx.readFile(req.file.path);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const name = row.name || row.Name;
        const code = row.code || row.Code;
        const credits = row.credits ?? row.Credits;
        const courseType = row.courseType || row.CourseType;
        const regulationYear = row.startYear || row.RegulationYear;

        if (!name || !code || !regulationYear) {
          failed++;
          continue;
        }

        const regulation = await Regulation.findOne({
          startYear: regulationYear
        });

        if (!regulation) {
          failed++;
          continue;
        }

        const normalizedName = String(name).trim();
        const normalizedCode = String(code).toUpperCase().trim();

        const duplicate = await Subject.findOne({
          departmentId,
          regulationId: regulation._id,
          $or: [{ code: normalizedCode }, { name: normalizedName }]
        });

        if (duplicate) {
          skipped++;
          continue;
        }

        await Subject.create({
          name: normalizedName,
          code: normalizedCode,
          credits,
          courseType,
          departmentId,
          regulationId: regulation._id
        });

        inserted++;
      } catch (err) {
        failed++;
      }
    }

    return res.json({
      success: true,
      message: 'Upload completed',
      data: {
        inserted,
        skipped,
        failed
      }
    });
  } catch (error) {
    return next(error);
  }
};
