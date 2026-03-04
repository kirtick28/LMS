import mongoose from 'mongoose';
import Regulation from '../models/Regulation.js';

/* ============================
   CREATE REGULATION
============================ */
export const createRegulation = async (req, res) => {
  try {
    const { name, startYear, totalSemesters } = req.body;

    if (!name && !startYear) {
      return res.status(400).json({ message: 'name or startYear is required' });
    }

    const normalizedName = name
      ? String(name).trim().toUpperCase()
      : `R${startYear}`;

    const existing = await Regulation.findOne({
      $or: [{ name: normalizedName }, ...(startYear ? [{ startYear }] : [])]
    });

    if (existing) {
      return res.status(409).json({ message: 'Regulation already exists' });
    }

    const regulation = await Regulation.create({
      name: normalizedName,
      startYear,
      totalSemesters
    });

    return res.status(201).json({
      message: 'Regulation created successfully',
      regulation
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

    return res.json(regulations);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ============================
   GET REGULATION BY ID
============================ */
export const getRegulationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid regulation id' });
    }

    const regulation = await Regulation.findById(id);

    if (!regulation) {
      return res.status(404).json({ message: 'Regulation not found' });
    }

    return res.json(regulation);
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
      return res.status(400).json({ message: 'Invalid regulation id' });
    }

    if (updates.name) {
      updates.name = String(updates.name).trim().toUpperCase();

      const duplicate = await Regulation.findOne({
        name: updates.name,
        _id: { $ne: id }
      });

      if (duplicate) {
        return res
          .status(409)
          .json({ message: 'Regulation name already exists' });
      }
    }

    if (updates.startYear) {
      const duplicateYear = await Regulation.findOne({
        startYear: updates.startYear,
        _id: { $ne: id }
      });

      if (duplicateYear) {
        return res
          .status(409)
          .json({ message: 'Regulation with same startYear already exists' });
      }
    }

    const regulation = await Regulation.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!regulation) {
      return res.status(404).json({ message: 'Regulation not found' });
    }

    return res.json({
      message: 'Regulation updated successfully',
      regulation
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* ============================
   DELETE REGULATION
============================ */
export const deleteRegulation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid regulation id' });
    }

    const regulation = await Regulation.findByIdAndDelete(id);

    if (!regulation) {
      return res.status(404).json({ message: 'Regulation not found' });
    }

    return res.json({
      message: 'Regulation deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
