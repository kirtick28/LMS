import Section from '../models/Section.js';
import Batch from '../models/Batch.js';

export const createSection = async (req, res) => {
  try {
    const { name, batchId, capacity, isActive } = req.body;

    if (!name || !batchId) {
      return res.status(400).json({ message: 'name and batchId are required' });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(400).json({ message: 'Invalid batchId' });
    }

    const normalizedName = String(name).trim().toUpperCase();

    const existing = await Section.findOne({
      name: normalizedName,
      batchId
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: 'Section already exists in this batch' });
    }

    const section = await Section.create({
      name: normalizedName,
      batchId,
      capacity,
      isActive
    });

    return res.status(201).json({
      message: 'Section created successfully',
      section
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAllSections = async (req, res) => {
  try {
    const { batchId, isActive } = req.query;
    const filter = {};

    if (batchId) filter.batchId = batchId;
    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const sections = await Section.find(filter)
      .populate({
        path: 'batchId',
        select: 'name admissionYear graduationYear departmentId',
        populate: {
          path: 'departmentId',
          select: 'name shortName'
        }
      })
      .sort({ name: 1 });

    return res.json(sections);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const section = await Section.findById(id).populate({
      path: 'batchId',
      select: 'name admissionYear graduationYear departmentId',
      populate: {
        path: 'departmentId',
        select: 'name shortName'
      }
    });

    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    return res.json(section);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.batchId) {
      const batch = await Batch.findById(updates.batchId);
      if (!batch) {
        return res.status(400).json({ message: 'Invalid batchId' });
      }
    }

    if (updates.name) {
      updates.name = String(updates.name).trim().toUpperCase();
    }

    if (updates.name || updates.batchId) {
      const current = await Section.findById(id);
      if (!current) {
        return res.status(404).json({ message: 'Section not found' });
      }

      const targetName = updates.name || current.name;
      const targetBatchId = updates.batchId || current.batchId;

      const duplicate = await Section.findOne({
        _id: { $ne: id },
        name: targetName,
        batchId: targetBatchId
      });

      if (duplicate) {
        return res
          .status(400)
          .json({ message: 'Section already exists in this batch' });
      }
    }

    const section = await Section.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    return res.json({
      message: 'Section updated successfully',
      section
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    const section = await Section.findByIdAndDelete(id);

    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    return res.json({ message: 'Section deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
