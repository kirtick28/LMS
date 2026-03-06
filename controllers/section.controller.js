import mongoose from 'mongoose';
import Section from '../models/Section.js';
import BatchProgram from '../models/BatchProgram.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const populateConfig = {
  path: 'batchProgramId',
  populate: [
    { path: 'batchId', select: 'name startYear endYear' },
    { path: 'departmentId', select: 'name code' },
    { path: 'regulationId', select: 'name startYear' }
  ]
};

export const createSection = async (req, res) => {
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
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getAllSections = async (req, res) => {
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
      .sort({ name: 1 });

    return res.json({
      success: true,
      message: 'Sections retrieved successfully',
      data: { sections }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getSectionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section id',
        data: {}
      });
    }

    const section = await Section.findById(id).populate(populateConfig);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Section retrieved successfully',
      data: { section }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const updateSection = async (req, res) => {
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
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const deleteSection = async (req, res) => {
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
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};
