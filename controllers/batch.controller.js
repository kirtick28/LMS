import Batch from '../models/Batch.js';
import Department from '../models/Department.js';
import Section from '../models/Section.js';
import Regulation from '../models/Regulation.js';

export const createBatch = async (req, res) => {
  try {
    const {
      name,
      departmentId,
      startYear,
      endYear,
      admissionYear,
      graduationYear,
      programDuration,
      regulationId,
      isActive
    } = req.body;

    if (!departmentId || (!admissionYear && !startYear)) {
      return res.status(400).json({
        message: 'departmentId and admissionYear/startYear are required'
      });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(400).json({ message: 'Invalid departmentId' });
    }

    if (regulationId) {
      const regulation = await Regulation.findById(regulationId);
      if (!regulation) {
        return res.status(400).json({ message: 'Invalid regulationId' });
      }
    }

    const resolvedStartYear = Number(startYear) || Number(admissionYear);

    const resolvedAdmission = Number(admissionYear || startYear);
    const resolvedDuration = Number(programDuration) || 4;
    const resolvedGraduation =
      Number(graduationYear || endYear) || resolvedAdmission + resolvedDuration;

    const existing = await Batch.findOne({
      departmentId,
      admissionYear: resolvedAdmission,
      graduationYear: resolvedGraduation
    });

    if (existing) {
      return res.status(400).json({
        message: 'Batch already exists for this department and year range'
      });
    }

    const batchName =
      name ||
      `${department.shortName || department.name}-${resolvedAdmission}-${resolvedGraduation}`;

    const batch = await Batch.create({
      name: batchName,
      departmentId,
      startYear: resolvedStartYear,
      endYear: resolvedGraduation,
      admissionYear: resolvedAdmission,
      graduationYear: resolvedGraduation,
      programDuration: resolvedDuration,
      regulationId: regulationId || null,
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
      { upsert: true }
    );

    return res.status(201).json({
      message: 'Batch created successfully',
      batch
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAllBatches = async (req, res) => {
  try {
    const { departmentId, isActive } = req.query;
    const filter = {};

    if (departmentId) filter.departmentId = departmentId;
    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const batches = await Batch.find(filter)
      .populate('departmentId', 'name shortName program isActive')
      .sort({ admissionYear: 1, name: 1 });

    return res.json(batches);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getBatchById = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await Batch.findById(id).populate(
      'departmentId',
      'name shortName program isActive'
    );

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    return res.json(batch);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.departmentId) {
      const department = await Department.findById(updates.departmentId);
      if (!department) {
        return res.status(400).json({ message: 'Invalid departmentId' });
      }
    }

    if (updates.regulationId) {
      const regulation = await Regulation.findById(updates.regulationId);
      if (!regulation) {
        return res.status(400).json({ message: 'Invalid regulationId' });
      }
    }

    const batch = await Batch.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    return res.json({
      message: 'Batch updated successfully',
      batch
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await Batch.findByIdAndDelete(id);

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    return res.json({ message: 'Batch deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
