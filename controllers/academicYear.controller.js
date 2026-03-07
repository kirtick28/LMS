import mongoose from 'mongoose';
import AcademicYear from '../models/AcademicYear.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createAcademicYear = async (req, res, next) => {
  try {
    const { startYear, endYear, startMonth, endMonth, isActive } = req.body;

    if (startYear == null || endYear == null) {
      return res.status(400).json({
        success: false,
        message: 'startYear and endYear are required',
        data: {}
      });
    }

    const name = `${startYear}-${endYear}`;

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
      startMonth,
      endMonth,
      isActive: isActive || false
    });

    return res.status(201).json({
      success: true,
      message: 'Academic Year created successfully',
      data: { academicYear }
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllAcademicYears = async (req, res, next) => {
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
    return next(error);
  }
};

export const getAcademicYearById = async (req, res, next) => {
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
    return next(error);
  }
};

export const updateAcademicYear = async (req, res, next) => {
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

    if (updates.startYear !== undefined || updates.endYear !== undefined) {
      const existingAcademicYear = await AcademicYear.findById(id);

      if (!existingAcademicYear) {
        return res.status(404).json({
          success: false,
          message: 'Academic Year not found',
          data: {}
        });
      }

      const effectiveStartYear =
        updates.startYear ?? existingAcademicYear.startYear;
      const effectiveEndYear = updates.endYear ?? existingAcademicYear.endYear;

      updates.name = `${effectiveStartYear}-${String(effectiveEndYear).slice(-2)}`;

      const duplicateName = await AcademicYear.findOne({
        _id: { $ne: id },
        name: updates.name
      });

      if (duplicateName) {
        return res.status(409).json({
          success: false,
          message: 'Academic Year already exists',
          data: {}
        });
      }
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
    return next(error);
  }
};

export const deleteAcademicYear = async (req, res, next) => {
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
    return next(error);
  }
};
