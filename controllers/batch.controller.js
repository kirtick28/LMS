import mongoose from 'mongoose';
import Batch from '../models/Batch.js';
import Department from '../models/Department.js';
import Section from '../models/Section.js';
import Regulation from '../models/Regulation.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/* ============================
   CREATE BATCH
============================ */
export const createBatch = async (req, res) => {
  try {
    const {
      name,
      departmentId,
      startYear,
      endYear,
      programDuration,
      regulationId,
      isActive
    } = req.body;

    if (!departmentId || !startYear || !regulationId) {
      return res.status(400).json({
        message: 'departmentId, startYear and regulationId are required'
      });
    }

    if (!isValidObjectId(departmentId)) {
      return res.status(400).json({ message: 'Invalid departmentId' });
    }

    if (!isValidObjectId(regulationId)) {
      return res.status(400).json({ message: 'Invalid regulationId' });
    }

    const [department, regulation] = await Promise.all([
      Department.findById(departmentId),
      Regulation.findById(regulationId)
    ]);

    if (!department) {
      return res.status(400).json({ message: 'Department not found' });
    }

    if (!regulation) {
      return res.status(400).json({ message: 'Regulation not found' });
    }

    const resolvedStartYear = Number(startYear);
    const resolvedDuration = Number(programDuration) || 4;
    const resolvedEndYear =
      Number(endYear) || resolvedStartYear + resolvedDuration;

    if (!resolvedStartYear || !resolvedEndYear) {
      return res
        .status(400)
        .json({ message: 'startYear and endYear must be valid numbers' });
    }

    if (resolvedStartYear >= resolvedEndYear) {
      return res
        .status(400)
        .json({ message: 'endYear must be greater than startYear' });
    }

    const existing = await Batch.findOne({
      departmentId,
      startYear: resolvedStartYear,
      endYear: resolvedEndYear
    });

    if (existing) {
      return res.status(409).json({
        message: 'Batch already exists for this department and year range'
      });
    }

    const batchName =
      name ||
      `${department.code || department.name}-${resolvedStartYear}-${resolvedEndYear}`;

    const batch = await Batch.create({
      name: batchName,
      departmentId,
      startYear: resolvedStartYear,
      endYear: resolvedEndYear,
      programDuration: resolvedDuration,
      regulationId,
      isActive
    });

    await Section.findOneAndUpdate(
      { batchId: batch._id, name: 'UNALLOCATED' },
      {
        $setOnInsert: {
          batchId: batch._id,
          name: 'UNALLOCATED',
          isActive: true
        }
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      message: 'Batch created successfully',
      batch
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ============================
   GET ALL BATCHES
============================ */
export const getAllBatches = async (req, res) => {
  try {
    const { departmentId, regulationId, isActive } = req.query;

    const filter = {};

    if (departmentId) {
      if (!isValidObjectId(departmentId)) {
        return res.status(400).json({ message: 'Invalid departmentId' });
      }
      filter.departmentId = departmentId;
    }

    if (regulationId) {
      if (!isValidObjectId(regulationId)) {
        return res.status(400).json({ message: 'Invalid regulationId' });
      }
      filter.regulationId = regulationId;
    }

    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const batches = await Batch.find(filter)
      .populate('departmentId', 'name code program isActive')
      .populate('regulationId', 'name startYear totalSemesters isActive')
      .sort({ startYear: 1, name: 1 });

    return res.json(batches);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ============================
   GET BATCH BY ID
============================ */
export const getBatchById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }

    const batch = await Batch.findById(id)
      .populate('departmentId', 'name code program isActive')
      .populate('regulationId', 'name startYear totalSemesters isActive');

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    return res.json(batch);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ============================
   UPDATE BATCH
============================ */
export const updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }

    const current = await Batch.findById(id);

    if (!current) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    if (updates.departmentId) {
      if (!isValidObjectId(updates.departmentId)) {
        return res.status(400).json({ message: 'Invalid departmentId' });
      }

      const department = await Department.findById(updates.departmentId);

      if (!department) {
        return res.status(400).json({ message: 'Department not found' });
      }
    }

    if (updates.regulationId) {
      if (!isValidObjectId(updates.regulationId)) {
        return res.status(400).json({ message: 'Invalid regulationId' });
      }

      const regulation = await Regulation.findById(updates.regulationId);

      if (!regulation) {
        return res.status(400).json({ message: 'Regulation not found' });
      }
    }

    const targetDepartmentId = updates.departmentId || current.departmentId;
    const targetStartYear = Number(updates.startYear || current.startYear);
    const targetEndYear = Number(updates.endYear || current.endYear);

    if (targetStartYear >= targetEndYear) {
      return res
        .status(400)
        .json({ message: 'endYear must be greater than startYear' });
    }

    if (
      updates.departmentId !== undefined ||
      updates.startYear !== undefined ||
      updates.endYear !== undefined
    ) {
      const duplicate = await Batch.findOne({
        _id: { $ne: id },
        departmentId: targetDepartmentId,
        startYear: targetStartYear,
        endYear: targetEndYear
      });

      if (duplicate) {
        return res.status(409).json({
          message: 'Batch already exists for this department and year range'
        });
      }
    }

    const batch = await Batch.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
      .populate('departmentId', 'name code program')
      .populate('regulationId', 'name startYear totalSemesters');

    return res.json({
      message: 'Batch updated successfully',
      batch
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ============================
   DELETE BATCH
============================ */
export const deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid batch id' });
    }

    const batch = await Batch.findByIdAndDelete(id);

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    return res.json({
      message: 'Batch deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
