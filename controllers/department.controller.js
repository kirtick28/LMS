import Department from '../models/Department.js';
import mongoose from 'mongoose';

/* ============================
   CREATE DEPARTMENT
============================ */
export const createDepartment = async (req, res) => {
  try {
    const { name, code, program, hodId, isActive } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'name and code are required',
        data: null
      });
    }

    const normalizedName = String(name).trim();
    const normalizedCode = String(code).toUpperCase().trim();

    const existing = await Department.findOne({
      $or: [{ name: normalizedName }, { code: normalizedCode }]
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Department with same name or code already exists',
        data: null
      });
    }

    const department = await Department.create({
      name: normalizedName,
      code: normalizedCode,
      program,
      hodId: hodId || null,
      isActive: isActive || true
    });

    return res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: {
        department
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

/* ============================
   GET ALL DEPARTMENTS
============================ */
export const getAllDepartments = async (req, res) => {
  try {
    const { isActive } = req.query;

    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const departments = await Department.find(filter)
      .populate('hodId', 'firstName lastName employeeId designation')
      .sort({ name: 1 });

    return res.json({
      success: true,
      data: {
        departments
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

/* ============================
   GET DEPARTMENT BY ID
============================ */
export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department id',
        data: null
      });
    }

    const department = await Department.findById(id).populate(
      'hodId',
      'firstName lastName employeeId designation'
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
        data: null
      });
    }

    return res.json({
      success: true,
      data: {
        department
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

/* ============================
   UPDATE DEPARTMENT
============================ */
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department id',
        data: null
      });
    }

    if (updates.name) {
      const duplicate = await Department.findOne({
        name: String(updates.name).trim(),
        _id: { $ne: id }
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Department name already exists',
          data: null
        });
      }

      updates.name = String(updates.name).trim();
    }

    if (updates.code) {
      const normalizedCode = String(updates.code).toUpperCase().trim();

      const duplicateCode = await Department.findOne({
        code: normalizedCode,
        _id: { $ne: id }
      });

      if (duplicateCode) {
        return res.status(409).json({
          success: false,
          message: 'Department code already exists',
          data: null
        });
      }

      updates.code = normalizedCode;
    }

    const department = await Department.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    }).populate('hodId', 'firstName lastName employeeId designation');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
        data: null
      });
    }

    return res.json({
      success: true,
      message: 'Department updated successfully',
      data: {
        department
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

/* ============================
   DELETE DEPARTMENT
============================ */
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department id',
        data: null
      });
    }

    const department = await Department.findByIdAndDelete(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
        data: null
      });
    }

    return res.json({
      success: true,
      message: 'Department deleted successfully',
      data: {
        department
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};
