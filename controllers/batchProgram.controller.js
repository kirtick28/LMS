import mongoose from 'mongoose';
import BatchProgram from '../models/BatchProgram.js';
import Batch from '../models/Batch.js';
import Department from '../models/Department.js';
import Regulation from '../models/Regulation.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createBatchProgram = async (req, res) => {
  try {
    const { batchId, departmentId, regulationId } = req.body;

    if (!batchId || !departmentId || !regulationId) {
      return res.status(400).json({
        success: false,
        message: 'batchId, departmentId, and regulationId are required',
        data: {}
      });
    }

    if (
      !isValidObjectId(batchId) ||
      !isValidObjectId(departmentId) ||
      !isValidObjectId(regulationId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ObjectId provided',
        data: {}
      });
    }

    const [batch, department, regulation] = await Promise.all([
      Batch.findById(batchId),
      Department.findById(departmentId),
      Regulation.findById(regulationId)
    ]);

    if (!batch || !department || !regulation) {
      return res.status(404).json({
        success: false,
        message: 'Batch, Department, or Regulation not found',
        data: {}
      });
    }

    const existing = await BatchProgram.findOne({
      batchId,
      departmentId
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'This department is already mapped to this batch',
        data: {}
      });
    }

    const batchProgram = await BatchProgram.create({
      batchId,
      departmentId,
      regulationId
    });

    const populated = await BatchProgram.findById(batchProgram._id)
      .populate('batchId', 'name startYear endYear')
      .populate('departmentId', 'name code')
      .populate('regulationId', 'name startYear');

    return res.status(201).json({
      success: true,
      message: 'BatchProgram created successfully',
      data: { batchProgram: populated }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getAllBatchPrograms = async (req, res) => {
  try {
    const { batchId, departmentId, regulationId } = req.query;

    const filter = {};

    if (batchId) {
      if (!isValidObjectId(batchId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid batchId',
          data: {}
        });
      }
      filter.batchId = batchId;
    }

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

    const batchPrograms = await BatchProgram.find(filter)
      .populate('batchId', 'name startYear endYear')
      .populate('departmentId', 'name code')
      .populate('regulationId', 'name startYear')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'BatchPrograms retrieved successfully',
      data: { batchPrograms }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getBatchProgramById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid BatchProgram id',
        data: {}
      });
    }

    const batchProgram = await BatchProgram.findById(id)
      .populate('batchId', 'name startYear endYear')
      .populate('departmentId', 'name code')
      .populate('regulationId', 'name startYear');

    if (!batchProgram) {
      return res.status(404).json({
        success: false,
        message: 'BatchProgram not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'BatchProgram retrieved successfully',
      data: { batchProgram }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const updateBatchProgram = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid BatchProgram id',
        data: {}
      });
    }

    const current = await BatchProgram.findById(id);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'BatchProgram not found',
        data: {}
      });
    }

    const objectIdFields = ['batchId', 'departmentId', 'regulationId'];
    for (const field of objectIdFields) {
      if (updates[field] && !isValidObjectId(updates[field])) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field}`,
          data: {}
        });
      }
    }

    if (updates.batchId || updates.departmentId || updates.regulationId) {
      const targetBatchId = updates.batchId || current.batchId;
      const targetDepartmentId = updates.departmentId || current.departmentId;
      const targetRegulationId = updates.regulationId || current.regulationId;

      const [batch, department, regulation] = await Promise.all([
        Batch.findById(targetBatchId),
        Department.findById(targetDepartmentId),
        Regulation.findById(targetRegulationId)
      ]);

      if (!batch || !department || !regulation) {
        return res.status(404).json({
          success: false,
          message: 'Referenced Batch, Department, or Regulation not found',
          data: {}
        });
      }

      if (updates.batchId || updates.departmentId) {
        const duplicate = await BatchProgram.findOne({
          _id: { $ne: id },
          batchId: targetBatchId,
          departmentId: targetDepartmentId
        });

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message: 'This department is already mapped to this batch',
            data: {}
          });
        }
      }
    }

    const batchProgram = await BatchProgram.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
      .populate('batchId', 'name startYear endYear')
      .populate('departmentId', 'name code')
      .populate('regulationId', 'name startYear');

    return res.json({
      success: true,
      message: 'BatchProgram updated successfully',
      data: { batchProgram }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const deleteBatchProgram = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid BatchProgram id',
        data: {}
      });
    }

    const batchProgram = await BatchProgram.findByIdAndDelete(id);

    if (!batchProgram) {
      return res.status(404).json({
        success: false,
        message: 'BatchProgram not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'BatchProgram deleted successfully',
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
