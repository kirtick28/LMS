import mongoose from 'mongoose';
import Regulation from '../models/Regulation.js';

const normalizeTotalSemesters = (value) => {
  const parsed = Number(value);

  if (!parsed || Number.isNaN(parsed)) {
    return 8;
  }

  return Math.min(Math.max(parsed, 1), 8);
};

/* ============================
   CREATE REGULATION
============================ */
export const createRegulation = async (req, res) => {
  try {
    const { name, startYear, totalSemesters } = req.body;

    if (!name && !startYear) {
      return res.status(400).json({
        success: false,
        message: 'name or startYear is required',
        data: null
      });
    }

    const normalizedName = name
      ? String(name).trim().toUpperCase()
      : `R${startYear}`;

    const existing = await Regulation.findOne({
      $or: [{ name: normalizedName }, ...(startYear ? [{ startYear }] : [])]
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Regulation already exists',
        data: null
      });
    }

    const regulation = await Regulation.create({
      name: normalizedName,
      startYear,
      totalSemesters: normalizeTotalSemesters(totalSemesters)
    });

    return res.status(201).json({
      success: true,
      message: 'Regulation created successfully',
      data: {
        regulation
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
   GET ALL REGULATIONS
============================ */
export const getAllRegulations = async (req, res) => {
  try {
    const regulations = await Regulation.find().sort({
      startYear: -1,
      name: 1
    });

    return res.json({
      success: true,
      data: {
        regulations
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
   GET REGULATION BY ID
============================ */
export const getRegulationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid regulation id',
        data: null
      });
    }

    const regulation = await Regulation.findById(id);

    if (!regulation) {
      return res.status(404).json({
        success: false,
        message: 'Regulation not found',
        data: null
      });
    }

    return res.json({
      success: true,
      data: {
        regulation
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
   UPDATE REGULATION
============================ */
export const updateRegulation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid regulation id',
        data: null
      });
    }

    if (updates.name) {
      updates.name = String(updates.name).trim().toUpperCase();

      const duplicate = await Regulation.findOne({
        name: updates.name,
        _id: { $ne: id }
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Regulation name already exists',
          data: null
        });
      }
    }

    if (updates.startYear) {
      const duplicateYear = await Regulation.findOne({
        startYear: updates.startYear,
        _id: { $ne: id }
      });

      if (duplicateYear) {
        return res.status(409).json({
          success: false,
          message: 'Regulation with same startYear already exists',
          data: null
        });
      }
    }

    if (updates.totalSemesters !== undefined) {
      updates.totalSemesters = normalizeTotalSemesters(updates.totalSemesters);
    }

    const regulation = await Regulation.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!regulation) {
      return res.status(404).json({
        success: false,
        message: 'Regulation not found',
        data: null
      });
    }

    return res.json({
      success: true,
      message: 'Regulation updated successfully',
      data: {
        regulation
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
   DELETE REGULATION
============================ */
export const deleteRegulation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid regulation id',
        data: null
      });
    }

    const regulation = await Regulation.findByIdAndDelete(id);

    if (!regulation) {
      return res.status(404).json({
        success: false,
        message: 'Regulation not found',
        data: null
      });
    }

    return res.json({
      success: true,
      message: 'Regulation deleted successfully',
      data: {
        regulation
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
