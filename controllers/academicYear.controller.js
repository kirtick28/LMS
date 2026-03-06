import mongoose from 'mongoose';
import AcademicYear from '../models/AcademicYear.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createAcademicYear = async (req, res) => {
  try {
    const { startYear, endYear, startDate, endDate, isActive } = req.body;

    if (!startYear || !endYear || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startYear, endYear, startDate, and endDate are required',
        data: {}
      });
    }

    const endYearShort = String(endYear).slice(-2);
    const name = `${startYear}-${endYearShort}`;

    const existing = await AcademicYear.findOne({ name });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Academic Year already exists',
        data: {}
      });
    }

    if (isActive) {
      await AcademicYear.updateMany({}, { isActive: false });
    }

    const academicYear = await AcademicYear.create({
      name,
      startYear,
      endYear,
      startDate,
      endDate,
      isActive: isActive || false
    });

    return res.status(201).json({
      success: true,
      message: 'Academic Year created successfully',
      data: { academicYear }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getAllAcademicYears = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const academicYears = await AcademicYear.find(filter).sort({
      startYear: -1
    });

    return res.json({
      success: true,
      message: 'Academic Years retrieved successfully',
      data: { academicYears }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getAcademicYearById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Academic Year id',
        data: {}
      });
    }

    const academicYear = await AcademicYear.findById(id);

    if (!academicYear) {
      return res.status(404).json({
        success: false,
        message: 'Academic Year not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Academic Year retrieved successfully',
      data: { academicYear }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const updateAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Academic Year id',
        data: {}
      });
    }

    if (updates.isActive === true) {
      await AcademicYear.updateMany({ _id: { $ne: id } }, { isActive: false });
    }

    const academicYear = await AcademicYear.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!academicYear) {
      return res.status(404).json({
        success: false,
        message: 'Academic Year not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Academic Year updated successfully',
      data: { academicYear }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const deleteAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Academic Year id',
        data: {}
      });
    }

    const academicYear = await AcademicYear.findByIdAndDelete(id);

    if (!academicYear) {
      return res.status(404).json({
        success: false,
        message: 'Academic Year not found',
        data: {}
      });
    }

    return res.json({
      success: true,
      message: 'Academic Year deleted successfully',
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
