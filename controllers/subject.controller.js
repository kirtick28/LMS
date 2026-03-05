import mongoose from 'mongoose';
import Subject from '../models/Subject.js';
import Department from '../models/Department.js';
import xlsx from 'xlsx';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createSubject = async (req, res) => {
  try {
    const { name, code, credits, courseType, departmentId, isActive } =
      req.body;

    if (!name || !code || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'name, code and departmentId are required',
        data: {}
      });
    }

    if (!isValidObjectId(departmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid departmentId',
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

    const normalizedName = String(name).trim();
    const normalizedCode = String(code).toUpperCase().trim();

    const duplicate = await Subject.findOne({
      $or: [{ code: normalizedCode }, { departmentId, name: normalizedName }]
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          'Subject with same code or same name in department already exists',
        data: {}
      });
    }

    const subject = await Subject.create({
      name: normalizedName,
      code: normalizedCode,
      credits,
      courseType,
      departmentId,
      isActive
    });

    const populated = await Subject.findById(subject._id).populate(
      'departmentId',
      'name code program isActive'
    );

    return res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: {
        subject: populated
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Subject code already exists in this department',
        data: {}
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getAllSubjects = async (req, res) => {
  try {
    const { departmentId, courseType, isActive } = req.query;

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

    if (courseType) {
      filter.courseType = String(courseType).toUpperCase().trim();
    }

    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const subjects = await Subject.find(filter)
      .populate('departmentId', 'name code program isActive')
      .sort({ code: 1, name: 1 });

    return res.json({
      success: true,
      message: 'Subjects retrieved successfully',
      data: {
        subjects
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject id',
        data: {}
      });
    }

    const subject = await Subject.findById(id).populate(
      'departmentId',
      'name code program isActive'
    );

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
      data: {
        subject
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const updateSubject = async (req, res) => {
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

    if (updates.departmentId) {
      if (!isValidObjectId(updates.departmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid departmentId',
          data: {}
        });
      }

      const department = await Department.findById(updates.departmentId);
      if (!department) {
        return res.status(400).json({
          success: false,
          message: 'Department not found',
          data: {}
        });
      }
    }

    if (updates.name !== undefined) {
      updates.name = String(updates.name).trim();
    }

    if (updates.code !== undefined) {
      updates.code = String(updates.code).toUpperCase().trim();
    }

    const targetDepartmentId = updates.departmentId || current.departmentId;
    const targetName = updates.name || current.name;
    const targetCode = updates.code || current.code;

    const duplicate = await Subject.findOne({
      _id: { $ne: id },
      $or: [
        { code: targetCode },
        { departmentId: targetDepartmentId, name: targetName }
      ]
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          'Subject with same code or same name in department already exists',
        data: {}
      });
    }

    const subject = await Subject.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    }).populate('departmentId', 'name code program isActive');

    return res.json({
      success: true,
      message: 'Subject updated successfully',
      data: {
        subject
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Subject code already exists in this department',
        data: {}
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const deleteSubject = async (req, res) => {
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
      data: {
        subject
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const uploadMultipleSubjects = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        data: {}
      });
    }

    const departmentId = req.params.departmentId || req.body.departmentId;

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'departmentId is required in params or body',
        data: {}
      });
    }

    if (!isValidObjectId(departmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid departmentId',
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

    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const name = row.name || row.Name;
        const code = row.code || row.Code;
        const credits = row.credits ?? row.Credits;
        const courseType = row.courseType || row.CourseType;

        if (!name || !code) {
          failed++;
          continue;
        }

        const normalizedName = String(name).trim();
        const normalizedCode = String(code).toUpperCase().trim();

        const duplicate = await Subject.findOne({
          $or: [
            { code: normalizedCode },
            { departmentId, name: normalizedName }
          ]
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
          departmentId
        });

        inserted++;
      } catch (error) {
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
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};
