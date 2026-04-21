import mongoose from 'mongoose';
import Subject from '../models/Subject.js';
import SubjectComponent from '../models/SubjectComponent.js';
import Regulation from '../models/Regulation.js';
import BatchProgram from '../models/BatchProgram.js';
import Curriculum from '../models/Curriculum.js';
import xlsx from 'xlsx';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const allowedSubjectUpdateFields = new Set([
  'name',
  'shortName',
  'code',
  'credits',
  'deliveryType',
  'courseCategory',
  'regulationId',
  'isActive'
]);

const subjectComponentsPopulate = {
  path: 'components',
  select: 'name shortName componentType hours isActive'
};

const normalizeSubjectPayload = ({ name, shortName, code }) => ({
  normalizedName: name.trim(),
  normalizedShortName: shortName.toUpperCase().trim(),
  normalizedCode: code.toUpperCase().trim()
});

const ensureUniqueSubject = async ({
  regulationId,
  name,
  code,
  excludeSubjectId,
  session
}) => {
  const filter = {
    regulationId,
    $or: [{ code }, { name }]
  };

  if (excludeSubjectId) {
    filter._id = { $ne: excludeSubjectId };
  }

  let query = Subject.findOne(filter);

  if (session) {
    query = query.session(session);
  }

  const duplicate = await query;

  if (duplicate) {
    throw new AppError(
      'Subject with same code or name already exists in this regulation',
      409
    );
  }
};

const buildSubjectComponents = (
  subject,
  lectureHours,
  practicalHours,
  projectHours
) => {
  const components = [];

  const baseName = subject.name;
  const short = subject.shortName;

  switch (subject.deliveryType) {
    case 'T':
      components.push({
        subjectId: subject._id,
        name: baseName,
        shortName: short,
        componentType: 'THEORY',
        hours: lectureHours || 0
      });
      break;

    case 'TP':
      components.push(
        {
          subjectId: subject._id,
          name: baseName,
          shortName: short,
          componentType: 'THEORY',
          hours: lectureHours || 0
        },
        {
          subjectId: subject._id,
          name: `${baseName} Laboratory`,
          shortName: `${short} LAB`,
          componentType: 'PRACTICAL',
          hours: practicalHours || 0
        }
      );
      break;

    case 'TPJ':
      components.push(
        {
          subjectId: subject._id,
          name: baseName,
          shortName: short,
          componentType: 'THEORY',
          hours: lectureHours || 0
        },
        {
          subjectId: subject._id,
          name: `${baseName} Laboratory`,
          shortName: `${short} LAB`,
          componentType: 'PRACTICAL',
          hours: practicalHours || 0
        },
        {
          subjectId: subject._id,
          name: `${baseName} Project`,
          shortName: `${short} PROJ`,
          componentType: 'PROJECT',
          hours: projectHours || 0
        }
      );
      break;

    case 'P':
      components.push({
        subjectId: subject._id,
        name: baseName,
        shortName: `${short}`,
        componentType: 'PRACTICAL',
        hours: practicalHours || 0
      });
      break;

    case 'PJ':
      components.push({
        subjectId: subject._id,
        name: baseName,
        shortName: `${short}`,
        componentType: 'PROJECT',
        hours: projectHours || 0
      });
      break;

    case 'I':
      components.push({
        subjectId: subject._id,
        name: baseName,
        shortName: short,
        componentType: 'INTERNSHIP',
        hours: projectHours || 0
      });
      break;
  }

  return components;
};

const createSubjectComponents = async (
  subject,
  lectureHours,
  practicalHours,
  projectHours,
  session
) => {
  const components = buildSubjectComponents(
    subject,
    lectureHours,
    practicalHours,
    projectHours
  );

  if (components.length) {
    const options = session ? { session } : undefined;
    await SubjectComponent.insertMany(components, options);
  }
};

export const createSubject = catchAsync(async (req, res, next) => {
  const {
    name,
    shortName,
    code,
    credits,
    deliveryType,
    courseCategory,
    regulationId,
    lectureHours,
    practicalHours,
    projectHours,
    isActive
  } = req.body;

  if (!name || !shortName || !code || !regulationId) {
    return res.status(400).json({
      success: false,
      message: 'name, shortName, code, regulationId required',
      data: {}
    });
  }

  if (!isValidObjectId(regulationId)) {
    return next(new AppError('Invalid regulationId', 400));
  }

  const regulation = await Regulation.findById(regulationId);
  if (!regulation) return next(new AppError('Regulation not found', 400));

  const { normalizedName, normalizedShortName, normalizedCode } =
    normalizeSubjectPayload({ name, shortName, code });

  await ensureUniqueSubject({
    regulationId,
    name: normalizedName,
    code: normalizedCode
  });

  const subject = await Subject.create({
    name: normalizedName,
    shortName: normalizedShortName,
    code: normalizedCode,
    credits,
    deliveryType,
    courseCategory,
    regulationId,
    isActive: isActive ?? true
  });

  await createSubjectComponents(
    subject,
    lectureHours,
    practicalHours,
    projectHours
  );

  const components = await SubjectComponent.find({
    subjectId: subject._id
  });

  const populated = await Subject.findById(subject._id)
    .populate('regulationId', 'name startYear')
    .populate(subjectComponentsPopulate);

  return res.status(201).json({
    success: true,
    message: 'Subject created successfully',
    data: {
      subject: populated,
      components
    }
  });
});

export const getAllSubjects = catchAsync(async (req, res, next) => {
  const { regulationId, deliveryType, isActive } = req.query;

  const filter = {};

  if (regulationId) filter.regulationId = regulationId;
  if (deliveryType) filter.deliveryType = deliveryType;

  if (isActive !== undefined) filter.isActive = String(isActive) === 'true';

  const subjects = await Subject.find(filter)
    .populate('regulationId', 'name startYear')
    .populate(subjectComponentsPopulate)
    .sort({ code: 1 });

  return res.json({
    success: true,
    message: 'Subjects retrieved successfully',
    data: { subjects }
  });
});

export const getSubjectById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!isValidObjectId(id))
    return next(new AppError('Invalid subject id', 400));

  const subject = await Subject.findById(id).populate(
    'regulationId',
    'name startYear'
  );

  if (!subject) return next(new AppError('Subject not found', 404));

  const components = await SubjectComponent.find({ subjectId: id });

  return res.json({
    success: true,
    message: 'Subject retrieved successfully',
    data: { subject, components }
  });
});

export const uploadMultipleSubjects = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Excel file is required', 400));
  }
  const { regulationId } = req.params;

  if (!isValidObjectId(regulationId)) {
    return next(new AppError('Invalid regulationId', 400));
  }

  const regulation = await Regulation.findById(regulationId);
  if (!regulation) return next(new AppError('Regulation not found', 404));

  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  if (!rows.length) {
    return next(new AppError('Excel file is empty', 400));
  }

  const errors = [];
  const validatedRows = [];

  const allowedDeliveryTypes = ['T', 'P', 'TP', 'TPJ', 'PJ', 'I'];

  const allowedCategories = [
    'Foundation',
    'Basic Science',
    'Engineering Science',
    'Professional Core',
    'Professional Elective',
    'Open Elective',
    'Mandatory',
    'Skill Enhancement',
    'Value Added',
    'Project',
    'Internship'
  ];

  const seenCodes = new Set();
  const seenNames = new Set();
  const normalizedCodes = [];
  const normalizedNames = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const row = rows[i];

    const name = row.name?.trim();
    const shortName = row.shortName?.toUpperCase().trim();
    const code = row.code?.toUpperCase().trim();
    const credits = Number(row.credits ?? 0);
    const deliveryType = row.deliveryType;
    const courseCategory = row.courseCategory;
    const lectureHours = Number(row.lectureHours ?? 0);
    const practicalHours = Number(row.practicalHours ?? 0);
    const projectHours = Number(row.projectHours ?? 0);

    if (!name || !shortName || !code) {
      errors.push({
        row: rowNumber,
        error: 'name, shortName and code are required'
      });
      continue;
    }

    if (!deliveryType || !allowedDeliveryTypes.includes(deliveryType)) {
      errors.push({
        row: rowNumber,
        error: `Invalid deliveryType. Allowed: ${allowedDeliveryTypes.join(', ')}`
      });
      continue;
    }

    if (!courseCategory || !allowedCategories.includes(courseCategory)) {
      errors.push({
        row: rowNumber,
        error: 'Invalid courseCategory'
      });
      continue;
    }

    if (seenCodes.has(code)) {
      errors.push({
        row: rowNumber,
        error: 'Duplicate subject code inside Excel'
      });
      continue;
    }

    if (seenNames.has(name)) {
      errors.push({
        row: rowNumber,
        error: 'Duplicate subject name inside Excel'
      });
      continue;
    }

    seenCodes.add(code);
    seenNames.add(name);
    normalizedCodes.push(code);
    normalizedNames.push(name);

    validatedRows.push({
      rowNumber,
      _id: new mongoose.Types.ObjectId(),
      name,
      shortName,
      code,
      credits,
      deliveryType,
      courseCategory,
      lectureHours,
      practicalHours,
      projectHours
    });
  }

  if (errors.length) {
    return res.status(400).json({
      success: false,
      message: 'Excel validation failed',
      errors
    });
  }

  const existingSubjects = await Subject.find({
    regulationId,
    $or: [
      { code: { $in: normalizedCodes } },
      { name: { $in: normalizedNames } }
    ]
  })
    .select('name code')
    .lean();

  if (existingSubjects.length) {
    const existingCodes = new Set(
      existingSubjects.map((subject) => subject.code)
    );
    const existingNames = new Set(
      existingSubjects.map((subject) => subject.name)
    );

    const duplicateRows = validatedRows
      .filter(
        (row) => existingCodes.has(row.code) || existingNames.has(row.name)
      )
      .map((row) => ({
        row: row.rowNumber,
        error: `Duplicate subject found: ${row.name} (${row.code})`
      }));

    return res.status(409).json({
      success: false,
      message: 'Duplicate subjects already exist in this regulation',
      errors: duplicateRows
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await Subject.insertMany(
      validatedRows.map((row) => ({
        _id: row._id,
        name: row.name,
        shortName: row.shortName,
        code: row.code,
        credits: row.credits,
        deliveryType: row.deliveryType,
        courseCategory: row.courseCategory,
        regulationId
      })),
      { session, ordered: true }
    );

    const components = validatedRows.flatMap((row) =>
      buildSubjectComponents(
        {
          _id: row._id,
          name: row.name,
          shortName: row.shortName,
          deliveryType: row.deliveryType
        },
        row.lectureHours,
        row.practicalHours,
        row.projectHours
      )
    );

    if (components.length) {
      await SubjectComponent.insertMany(components, {
        session,
        ordered: true
      });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: `${validatedRows.length} subjects uploaded successfully`
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return next(err);
  }
});

export const updateSubject = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!isValidObjectId(id))
    return next(new AppError('Invalid subject id', 400));

  const subject = await Subject.findById(id);

  if (!subject) return next(new AppError('Subject not found', 404));

  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) =>
      allowedSubjectUpdateFields.has(key)
    )
  );

  if (updates.regulationId !== undefined) {
    if (!isValidObjectId(updates.regulationId)) {
      return next(new AppError('Invalid regulationId', 400));
    }

    const regulation = await Regulation.findById(updates.regulationId);
    if (!regulation) return next(new AppError('Regulation not found', 400));
  }

  const nextName =
    updates.name !== undefined ? updates.name.trim() : subject.name;
  const nextShortName =
    updates.shortName !== undefined
      ? updates.shortName.toUpperCase().trim()
      : subject.shortName;
  const nextCode =
    updates.code !== undefined
      ? updates.code.toUpperCase().trim()
      : subject.code;
  const nextRegulationId = updates.regulationId || subject.regulationId;

  await ensureUniqueSubject({
    regulationId: nextRegulationId,
    name: nextName,
    code: nextCode,
    excludeSubjectId: subject._id
  });

  Object.assign(subject, {
    ...updates,
    name: nextName,
    shortName: nextShortName,
    code: nextCode
  });

  await subject.save();

  const populated = await Subject.findById(subject._id)
    .populate('regulationId', 'name startYear')
    .populate(subjectComponentsPopulate);

  return res.json({
    success: true,
    message: 'Subject updated successfully',
    data: { subject: populated }
  });
});

export const deleteSubject = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!isValidObjectId(id))
    return next(new AppError('Invalid subject id', 400));

  await SubjectComponent.deleteMany({ subjectId: id });

  const subject = await Subject.findByIdAndDelete(id);

  if (!subject) return next(new AppError('Subject not found', 404));

  return res.json({
    success: true,
    message: 'Subject deleted successfully',
    data: { subject }
  });
});

export const getSubjectsForSemester = catchAsync(async (req, res, next) => {
  const { batchProgramId, semesterNumber } = req.query;

  const batchProgram = await BatchProgram.findById(batchProgramId);

  if (!batchProgram) return next(new AppError('Batch program not found', 404));

  const curriculum = await Curriculum.findOne({
    departmentId: batchProgram.departmentId,
    regulationId: batchProgram.regulationId
  });

  if (!curriculum)
    return res.json({
      success: true,
      message: 'No subjects found',
      data: { subjects: [] }
    });

  const semester = curriculum.semesters.find(
    (s) => s.semesterNumber === Number(semesterNumber)
  );

  if (!semester)
    return res.json({
      success: true,
      message: 'No subjects found',
      data: { subjects: [] }
    });

  const subjects = await Subject.find({
    _id: { $in: semester.subjects }
  })
    .populate('regulationId', 'name startYear')
    .populate(subjectComponentsPopulate)
    .sort({ code: 1 });

  return res.json({
    success: true,
    message: 'Subjects retrieved successfully',
    data: { subjects }
  });
});
