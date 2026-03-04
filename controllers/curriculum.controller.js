import mongoose from 'mongoose';
import Curriculum from '../models/Curriculum.js';
import Department from '../models/Department.js';
import Regulation from '../models/Regulation.js';
import Subject from '../models/Subject.js';

const validateSemesters = async (semesters = []) => {
  for (const semester of semesters) {
    if (!semester.semesterNumber || semester.semesterNumber < 1) {
      throw new Error('Invalid semesterNumber in semesters');
    }

    if (!Array.isArray(semester.subjects)) {
      throw new Error('subjects must be an array');
    }

    for (const item of semester.subjects) {
      if (!item.subjectId || !mongoose.Types.ObjectId.isValid(item.subjectId)) {
        throw new Error('Invalid subjectId in semesters');
      }
    }
  }

  const subjectIds = semesters.flatMap((semester) =>
    semester.subjects.map((subject) => subject.subjectId)
  );

  if (subjectIds.length) {
    const count = await Subject.countDocuments({ _id: { $in: subjectIds } });
    if (count !== subjectIds.length) {
      throw new Error('One or more subjects do not exist');
    }
  }
};

export const createCurriculum = async (req, res) => {
  try {
    const { departmentId, regulationId, semesters, isActive } = req.body;

    if (!departmentId || !regulationId) {
      return res
        .status(400)
        .json({ message: 'departmentId and regulationId are required' });
    }

    const [department, regulation] = await Promise.all([
      Department.findById(departmentId),
      Regulation.findById(regulationId)
    ]);

    if (!department) {
      return res.status(400).json({ message: 'Invalid departmentId' });
    }

    if (!regulation) {
      return res.status(400).json({ message: 'Invalid regulationId' });
    }

    await validateSemesters(semesters || []);

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
    return res.status(500).json({ message: error.message });
  }
};

export const getAllCurriculums = async (req, res) => {
  try {
    const { departmentId, regulationId, isActive } = req.query;
    const filter = {};

    if (departmentId) filter.departmentId = departmentId;
    if (regulationId) filter.regulationId = regulationId;
    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const curriculums = await Curriculum.find(filter)
      .populate('departmentId', 'name code shortName')
      .populate('regulationId', 'name startYear totalSemesters')
      .populate('semesters.subjects.subjectId', 'name code courseType credits')
      .sort({ createdAt: -1 });

    return res.json(curriculums);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getCurriculumById = async (req, res) => {
  try {
    const { id } = req.params;

    const curriculum = await Curriculum.findById(id)
      .populate('departmentId', 'name code shortName')
      .populate('regulationId', 'name startYear totalSemesters')
      .populate('semesters.subjects.subjectId', 'name code courseType credits');

    if (!curriculum) {
      return res.status(404).json({ message: 'Curriculum not found' });
    }

    return res.json(curriculum);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateCurriculum = async (req, res) => {
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

    if (updates.semesters) {
      await validateSemesters(updates.semesters);
    }

    const curriculum = await Curriculum.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!curriculum) {
      return res.status(404).json({ message: 'Curriculum not found' });
    }

    return res.json({
      message: 'Curriculum updated successfully',
      curriculum
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteCurriculum = async (req, res) => {
  try {
    const { id } = req.params;
    const curriculum = await Curriculum.findByIdAndDelete(id);

    if (!curriculum) {
      return res.status(404).json({ message: 'Curriculum not found' });
    }

    return res.json({ message: 'Curriculum deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
