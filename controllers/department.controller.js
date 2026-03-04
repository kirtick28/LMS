import Department from '../models/Department.js';

export const createDepartment = async (req, res) => {
  try {
    const { name, shortName, code, program, hodId, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }

    const existing = await Department.findOne({ name: String(name).trim() });
    if (existing) {
      return res.status(400).json({ message: 'Department already exists' });
    }

    const department = await Department.create({
      name,
      shortName,
      code,
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

export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
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

export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.name) {
      const duplicate = await Department.findOne({
        name: String(updates.name).trim(),
        _id: { $ne: id }
      });

      if (duplicate) {
        return res
          .status(400)
          .json({ message: 'Department name already exists' });
      }
    }

    if (updates.code) {
      const duplicateCode = await Department.findOne({
        code: String(updates.code).toUpperCase().trim(),
        _id: { $ne: id }
      });

      if (duplicateCode) {
        return res
          .status(400)
          .json({ message: 'Department code already exists' });
      }
    }

    const department = await Department.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

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

export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await Department.findByIdAndDelete(id);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    return res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
