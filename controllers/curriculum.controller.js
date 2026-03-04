import mongoose from 'mongoose';
import Curriculum from '../models/Curriculum.js';
import Department from '../models/Department.js';
import Regulation from '../models/Regulation.js';
import Subject from '../models/Subject.js';

/* =========================
   HELPERS
========================= */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateSemesters = async (semesters = []) => {
  if (!Array.isArray(semesters)) {
    throw new Error('semesters must be an array');
  }

  const seenSemesters = new Set();
  const subjectIds = [];

  for (const semester of semesters) {
    if (!semester.semesterNumber || semester.semesterNumber < 1) {
      throw new Error('Invalid semesterNumber in semesters');
    }

    if (seenSemesters.has(semester.semesterNumber)) {
      throw new Error(`Duplicate semesterNumber: ${semester.semesterNumber}`);
    }

    seenSemesters.add(semester.semesterNumber);

    if (!Array.isArray(semester.subjects)) {
      throw new Error('subjects must be an array');
    }

    for (const subjectId of semester.subjects) {
      if (!subjectId || !isValidObjectId(subjectId)) {
        throw new Error('Invalid subjectId in semesters');
      }

      subjectIds.push(subjectId);
    }
  }

  if (subjectIds.length) {
    const uniqueSubjectIds = [...new Set(subjectIds.map((id) => String(id)))];

    const count = await Subject.countDocuments({
      _id: { $in: uniqueSubjectIds }
    });

    if (count !== uniqueSubjectIds.length) {
      throw new Error('One or more subjects do not exist');
    }
  }
};

const isBadRequestError = (error) => {
  if (!error) return false;

  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return true;
  }

  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('invalid') ||
    msg.includes('required') ||
    msg.includes('duplicate') ||
    msg.includes('does not exist') ||
    msg.includes('must be')
  );
};

/* =========================
   CREATE CURRICULUM
========================= */

export const createCurriculum = async (req, res) => {
  try {
    const { departmentId, regulationId, semesters, isActive } = req.body;

    if (!departmentId || !regulationId) {
      return res
        .status(400)
        .json({ message: 'departmentId and regulationId are required' });
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

    await validateSemesters(semesters || []);

    const existing = await Curriculum.findOne({
      departmentId,
      regulationId
    });

    if (existing) {
      return res.status(409).json({
        message: 'Curriculum already exists for this department and regulation'
      });
    }

    const curriculum = await Curriculum.create({
      departmentId,
      regulationId,
      semesters: semesters || [],
      isActive
    });

    return res.status(201).json({
      message: 'Curriculum created successfully',
      curriculum
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

/* =========================
   GET ALL CURRICULUMS
========================= */

export const getAllCurriculums = async (req, res) => {
  try {
    const { departmentId, regulationId, isActive } = req.query;

    const filter = {};

    if (departmentId && isValidObjectId(departmentId)) {
      filter.departmentId = departmentId;
    }

    if (regulationId && isValidObjectId(regulationId)) {
      filter.regulationId = regulationId;
    }

    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const curriculums = await Curriculum.find(filter)
      .populate('departmentId', 'name code')
      .populate('regulationId', 'name startYear totalSemesters')
      .populate('semesters.subjects', 'name code courseType credits')
      .sort({ createdAt: -1 });

    return res.json(curriculums);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

/* =========================
   GET CURRICULUM BY ID
========================= */

export const getCurriculumById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid curriculum id' });
    }

    const curriculum = await Curriculum.findById(id)
      .populate('departmentId', 'name code')
      .populate('regulationId', 'name startYear totalSemesters')
      .populate('semesters.subjects', 'name code courseType credits');

    if (!curriculum) {
      return res.status(404).json({ message: 'Curriculum not found' });
    }

    return res.json(curriculum);
  } catch (error) {
    return res
      .status(isBadRequestError(error) ? 400 : 500)
      .json({ message: error.message });
  }
};

/* =========================
   UPDATE CURRICULUM
========================= */

export const updateCurriculum = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid curriculum id' });
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

    if (updates.semesters) {
      await validateSemesters(updates.semesters);
    }

    const curriculum = await Curriculum.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
      .populate('departmentId', 'name code')
      .populate('regulationId', 'name startYear totalSemesters')
      .populate('semesters.subjects', 'name code courseType credits');

    if (!curriculum) {
      return res.status(404).json({ message: 'Curriculum not found' });
    }

    return res.json({
      message: 'Curriculum updated successfully',
      curriculum
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

/* =========================
   DELETE CURRICULUM
========================= */

export const deleteCurriculum = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid curriculum id' });
    }

    const curriculum = await Curriculum.findByIdAndDelete(id);

    if (!curriculum) {
      return res.status(404).json({ message: 'Curriculum not found' });
    }

    return res.json({
      message: 'Curriculum deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
