import mongoose from 'mongoose';
import BatchProgram from '../models/BatchProgram.js';
import Batch from '../models/Batch.js';
import Department from '../models/Department.js';
import Regulation from '../models/Regulation.js';
import Section from '../models/Section.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const getBatchProgramDetailsByParams = async (req, res) => {
  try {
    const batchId = req.params.batchId || req.query.batchId;
    const departmentId = req.params.departmentId || req.query.departmentId;

    if (!batchId || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'batchId and departmentId are required',
        data: {}
      });
    }

    if (!isValidObjectId(batchId) || !isValidObjectId(departmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batchId or departmentId',
        data: {}
      });
    }

    const [batch, department] = await Promise.all([
      Batch.findById(batchId),
      Department.findById(departmentId)
    ]);

    if (!batch || !department) {
      return res.status(404).json({
        success: false,
        message: 'Batch, Department, or Regulation not found',
        data: {}
      });
    }

    const batchProgram = await BatchProgram.findOne({
      batchId,
      departmentId
    })
      .populate('batchId', 'name startYear endYear')
      .populate('departmentId', 'name code program')
      .populate('regulationId', 'name startYear');

    if (!batchProgram) {
      return res.status(404).json({
        success: false,
        message: 'BatchProgram not found for this department and batch',
        data: {
          batchProgram: {
            departmentId: {
              _id: department._id,
              name: department.name,
              code: department.code,
              program: department.program
            },
            batchId: {
              _id: batch._id,
              name: batch.name,
              startYear: batch.startYear,
              endYear: batch.endYear
            }
          }
        }
      });
    }

    return res.json({
      success: true,
      message: 'BatchProgram details retrieved successfully',
      data: {
        batchProgramId: batchProgram._id,
        batchProgram
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

    try {
      await Section.findOneAndUpdate(
        {
          name: 'UNALLOCATED',
          batchProgramId: batchProgram._id
        },
        {
          $setOnInsert: {
            name: 'UNALLOCATED',
            batchProgramId: batchProgram._id,
            capacity: 300,
            isActive: true
          }
        },
        { upsert: true, new: true }
      );
    } catch (sectionError) {
      await BatchProgram.findByIdAndDelete(batchProgram._id);
      throw sectionError;
    }

    const populated = await BatchProgram.findById(batchProgram._id)
      .populate('batchId', 'name startYear endYear')
      .populate('departmentId', 'name code program')
      .populate('regulationId', 'name startYear');

    return res.status(201).json({
      success: true,
      message: 'BatchProgram and UNALLOCATED section created successfully',
      data: { batchProgram: populated }
    });
  } catch (error) {
    if (
      error.code === 11000 &&
      (error.keyPattern?.batchId || error.keyPattern?.departmentId)
    ) {
      return res.status(409).json({
        success: false,
        message: 'This department is already mapped to this batch',
        data: {}
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate key conflict while creating related records',
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
