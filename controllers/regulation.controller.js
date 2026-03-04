import Regulation from '../models/Regulation.js';

export const createRegulation = async (req, res) => {
  try {
    const { name, startYear, totalSemesters } = req.body;

    if (!name && !startYear) {
      return res.status(400).json({ message: 'name or startYear is required' });
    }

    const regulation = await Regulation.create({
      name,
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

export const getRegulationById = async (req, res) => {
  try {
    const { id } = req.params;
    const regulation = await Regulation.findById(id);

    if (!regulation) {
      return res.status(404).json({ message: 'Regulation not found' });
    }

    return res.json(regulation);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateRegulation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

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

export const deleteRegulation = async (req, res) => {
  try {
    const { id } = req.params;
    const regulation = await Regulation.findByIdAndDelete(id);

    if (!regulation) {
      return res.status(404).json({ message: 'Regulation not found' });
    }

    return res.json({ message: 'Regulation deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
