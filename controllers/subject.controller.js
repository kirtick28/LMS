import mongoose from 'mongoose';
import Subject from '../models/Subject.js';
import SubjectComponent from '../models/SubjectComponent.js';
import Department from '../models/Department.js';
import Regulation from '../models/Regulation.js';
import BatchProgram from '../models/BatchProgram.js';
import Curriculum from '../models/Curriculum.js';
import xlsx from 'xlsx';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const createSubjectComponents = async (
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

  if (components.length) {
    await SubjectComponent.insertMany(components);
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
    departmentId,
    regulationId,
    lectureHours,
    practicalHours,
    projectHours,
    isActive
  } = req.body;

  if (!name || !shortName || !code || !departmentId || !regulationId) {
    return res.status(400).json({
      success: false,
      message: 'name, shortName, code, departmentId, regulationId required',
      data: {}
    });
  }

  if (!isValidObjectId(departmentId) || !isValidObjectId(regulationId)) {
    return next(new AppError('Invalid departmentId or regulationId', 400));
  }

  const department = await Department.findById(departmentId);
  if (!department) return next(new AppError('Department not found', 400));

  const regulation = await Regulation.findById(regulationId);
  if (!regulation) return next(new AppError('Regulation not found', 400));

  const normalizedName = name.trim();
  const normalizedCode = code.toUpperCase().trim();

  const duplicate = await Subject.findOne({
    departmentId,
    regulationId,
    $or: [{ code: normalizedCode }, { name: normalizedName }]
  });

  if (duplicate) {
    return next(
      new AppError(
        'Subject with same code or name already exists in this regulation',
        409
      )
    );
  }

  const subject = await Subject.create({
    name: normalizedName,
    shortName,
    code: normalizedCode,
    credits,
    deliveryType,
    courseCategory,
    departmentId,
    regulationId,
    isActive: isActive || true
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
    .populate('departmentId', 'name code program')
    .populate('regulationId', 'name startYear');

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
  const { departmentId, regulationId, deliveryType, isActive } = req.query;

  const filter = {};

  if (departmentId) filter.departmentId = departmentId;
  if (regulationId) filter.regulationId = regulationId;
  if (deliveryType) filter.deliveryType = deliveryType;

  if (isActive !== undefined) filter.isActive = String(isActive) === 'true';

  const subjects = await Subject.find(filter)
    .populate('departmentId', 'name code program')
    .populate('regulationId', 'name startYear')
    .populate({
      path: 'components',
      select: 'name shortName componentType hours isActive'
    })
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

  const subject = await Subject.findById(id)
    .populate('departmentId', 'name code program')
    .populate('regulationId', 'name startYear');

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

  const { departmentId, regulationId } = req.params;

  if (!isValidObjectId(departmentId) || !isValidObjectId(regulationId)) {
    return next(new AppError('Invalid departmentId or regulationId', 400));
  }

  const department = await Department.findById(departmentId);
  if (!department) return next(new AppError('Department not found', 404));

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

  const seen = new Set();

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

    const key = `${code}`;

    if (seen.has(key)) {
      errors.push({
        row: rowNumber,
        error: 'Duplicate subject code inside Excel'
      });
      continue;
    }

    seen.add(key);

    validatedRows.push({
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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const row of validatedRows) {
      const duplicate = await Subject.findOne({
        departmentId,
        regulationId,
        $or: [{ code: row.code }, { name: row.name }]
      }).session(session);

      if (duplicate) {
        throw new AppError(
          `Duplicate subject found: ${row.name} (${row.code})`,
          409
        );
      }

      const subject = await Subject.create(
        [
          {
            name: row.name,
            shortName: row.shortName,
            code: row.code,
            credits: row.credits,
            deliveryType: row.deliveryType,
            courseCategory: row.courseCategory,
            departmentId,
            regulationId
          }
        ],
        { session }
      );

      await createSubjectComponents(
        subject[0],
        row.lectureHours,
        row.practicalHours,
        row.projectHours
      );
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

  Object.assign(subject, req.body);

  await subject.save();

  return res.json({
    success: true,
    message: 'Subject updated successfully',
    data: { subject }
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
    .populate('departmentId', 'name code program')
    .populate('regulationId', 'name startYear')
    .populate({
      path: 'components',
      select: 'name shortName componentType hours isActive'
    })
    .sort({ code: 1 });

  return res.json({
    success: true,
    message: 'Subjects retrieved successfully',
    data: { subjects }
  });
});
