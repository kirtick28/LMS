import Department from '../models/Department.js';
import mongoose from 'mongoose';

/* ============================
   CREATE DEPARTMENT
============================ */
export const createDepartment = async (req, res) => {
  try {
    const { name, code, program, hodId, isActive } = req.body;

    if (!name || !code) {
      return res.status(400).json({ message: 'name and code are required' });
    }

    const normalizedName = String(name).trim();
    const normalizedCode = String(code).toUpperCase().trim();

    const existing = await Department.findOne({
      $or: [{ name: normalizedName }, { code: normalizedCode }]
    });

    if (existing) {
      return res
        .status(409)
        .json({ message: 'Department with same name or code already exists' });
    }

    const department = await Department.create({
      name: normalizedName,
      code: normalizedCode,
      program,
      hodId: hodId || null,
      isActive
    });

    return res.status(201).json({
      message: 'Department created successfully',
      department
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

    return res.json(departments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ============================
   GET DEPARTMENT BY ID
============================ */
export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid department id' });
    }

    const department = await Department.findById(id).populate(
      'hodId',
      'firstName lastName employeeId designation'
    );

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    return res.json(department);
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
      return res.status(400).json({ message: 'Invalid department id' });
    }

    if (updates.name) {
      const duplicate = await Department.findOne({
        name: String(updates.name).trim(),
        _id: { $ne: id }
      });

      if (duplicate) {
        return res
          .status(409)
          .json({ message: 'Department name already exists' });
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
        return res
          .status(409)
          .json({ message: 'Department code already exists' });
      }

      updates.code = normalizedCode;
    }

    const department = await Department.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    }).populate('hodId', 'firstName lastName employeeId designation');

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    return res.json({
      message: 'Department updated successfully',
      department
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ============================
   DELETE DEPARTMENT
============================ */
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid department id' });
    }

    const department = await Department.findByIdAndDelete(id);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    return res.json({
      message: 'Department deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
