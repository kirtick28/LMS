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
        name: `${baseName} Laboratory`,
        shortName: `${short} LAB`,
        componentType: 'PRACTICAL',
        hours: practicalHours || 0
      });
      break;

    case 'PJ':
      components.push({
        subjectId: subject._id,
        name: `${baseName} Project`,
        shortName: `${short} PROJ`,
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
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
      data: {}
    });
  }

  const departmentId = req.params.departmentId || req.body.departmentId;

  if (!departmentId || !isValidObjectId(departmentId)) {
    return res.status(400).json({
      success: false,
      message: 'Valid departmentId required',
      data: {}
    });
  }

  const department = await Department.findById(departmentId);

  if (!department) {
    return res.status(400).json({
      success: false,
      message: 'Department not found',
      data: {}
    });
  }

  const workbook = req.file.buffer
    ? xlsx.read(req.file.buffer, { type: 'buffer' })
    : xlsx.readFile(req.file.path);

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  // Start MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    for (const row of rows) {
      const name = row.name || row.Name;
      const shortName = row.shortName || row.ShortName;
      const code = row.code || row.Code;
      const credits = row.credits ?? row.Credits;
      const deliveryType =
        row.deliveryType || row.DeliveryType || row.courseType;
      const courseCategory = row.courseCategory || row.CourseCategory;
      const lectureHours = row.lectureHours ?? row.LectureHours ?? 0;
      const practicalHours = row.practicalHours ?? row.PracticalHours ?? 0;
      const projectHours = row.projectHours ?? row.ProjectHours ?? 0;
      const regulationYear = row.startYear || row.RegulationYear;

      if (!name || !shortName || !code || !deliveryType || !regulationYear) {
        failed++;
        // Abort transaction and throw error to ensure atomicity
        throw new AppError(
          'Missing required fields in one or more rows. Aborting upload.',
          400
        );
      }

      const regulation = await Regulation.findOne({
        startYear: regulationYear
      }).session(session);
      if (!regulation) {
        failed++;
        throw new AppError(
          'Regulation not found for one or more rows. Aborting upload.',
          400
        );
      }

      const normalizedName = String(name).trim();
      const normalizedCode = String(code).toUpperCase().trim();

      const duplicate = await Subject.findOne({
        departmentId,
        regulationId: regulation._id,
        $or: [{ code: normalizedCode }, { name: normalizedName }]
      }).session(session);

      if (duplicate) {
        skipped++;
        throw new AppError(
          'Duplicate subject found in one or more rows. Aborting upload.',
          409
        );
      }

      const subject = await Subject.create(
        [
          {
            name: normalizedName,
            shortName: String(shortName).toUpperCase().trim(),
            code: normalizedCode,
            credits,
            deliveryType,
            courseCategory,
            departmentId,
            regulationId: regulation._id
          }
        ],
        { session }
      );

      await createSubjectComponents(
        subject[0],
        lectureHours,
        practicalHours,
        projectHours
      );

      inserted++;
    }
    await session.commitTransaction();
    session.endSession();
    return res.json({
      success: true,
      message: 'Upload completed',
      data: {
        inserted,
        skipped,
        failed
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
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
  });

  return res.json({
    success: true,
    message: 'Subjects retrieved successfully',
    data: { subjects }
  });
});
