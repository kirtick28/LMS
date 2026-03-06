import mongoose from 'mongoose';
import Batch from '../models/Batch.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createBatch = async (req, res) => {
  try {
    const { name, startYear, endYear, programDuration, isActive } = req.body;

    if (!startYear) {
      return res.status(400).json({
        success: false,
        message: 'startYear is required',
        data: {}
      });
    }

    const resolvedStartYear = Number(startYear);
    const resolvedDuration = Number(programDuration) || 4;
    const resolvedEndYear =
      Number(endYear) || resolvedStartYear + resolvedDuration;

    if (resolvedStartYear >= resolvedEndYear) {
      return res.status(400).json({
        success: false,
        message: 'endYear must be greater than startYear',
        data: {}
      });
    }

    const existing = await Batch.findOne({
      startYear: resolvedStartYear,
      endYear: resolvedEndYear
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Batch already exists for this year range',
        data: {}
      });
    }

    const batchName = name || `${resolvedStartYear}-${resolvedEndYear}`;

    const batch = await Batch.create({
      name: batchName,
      startYear: resolvedStartYear,
      endYear: resolvedEndYear,
      programDuration: resolvedDuration,
      isActive
    });

    return res.status(201).json({
      success: true,
      message: 'Batch created successfully',
      data: { batch }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getAllBatches = async (req, res) => {
  try {
    const { isActive } = req.query;

    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const batches = await Batch.find(filter).sort({ startYear: 1, name: 1 });

    return res.json({
      success: true,
      message: 'Batches retrieved successfully',
      data: { batches }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getBatchById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch id',
        data: {}
      });
    }

    const batch = await Batch.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Batch retrieved successfully',
      data: { batch }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch id',
        data: {}
      });
    }

    const current = await Batch.findById(id);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
        data: {}
      });
    }

    const targetStartYear = Number(updates.startYear || current.startYear);
    const targetEndYear = Number(updates.endYear || current.endYear);

    if (targetStartYear >= targetEndYear) {
      return res.status(400).json({
        success: false,
        message: 'endYear must be greater than startYear',
        data: {}
      });
    }

    const duplicate = await Batch.findOne({
      _id: { $ne: id },
      startYear: targetStartYear,
      endYear: targetEndYear
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Batch already exists for this year range',
        data: {}
      });
    }

    delete updates.regulationId;

    const batch = await Batch.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    return res.json({
      success: true,
      message: 'Batch updated successfully',
      data: { batch }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch id',
        data: {}
      });
    }

    const batch = await Batch.findByIdAndDelete(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Batch deleted successfully',
      data: { batch }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};
