import Student from '../models/Student.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Batch from '../models/Batch.js';
import BatchProgram from '../models/BatchProgram.js';
import Section from '../models/Section.js';
import Regulation from '../models/Regulation.js';
import mongoose from 'mongoose';
import xlsx from 'xlsx';

const DEFAULT_SECTION_NAME = 'UNALLOCATED';

const toObjectId = (value, field) => {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return new mongoose.Types.ObjectId(value);
};

const normalizeCode = (value) => {
  if (!value) return '';
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
};

const normalizeTotalSemesters = (value) => {
  const parsed = Number(value);

  if (!parsed || Number.isNaN(parsed)) {
    return 8;
  }

  return Math.min(Math.max(parsed, 1), 8);
};

const getYearFromSemester = (semester) => {
  const sem = Number(semester);
  if (!sem || sem < 1) return null;
  const year = Math.ceil(sem / 2);
  if (year < 1 || year > 4) return null;
  return year;
};

const resolveDepartment = async (payload) => {
  if (payload.departmentId) {
    const dept = await Department.findById(payload.departmentId);
    if (!dept) throw new Error('Invalid departmentId');
    return dept;
  }

  if (!payload.departmentName) {
    throw new Error('departmentId or departmentName required');
  }

  const code = normalizeCode(payload.departmentCode || payload.departmentName);

  let dept = await Department.findOne({
    $or: [{ name: payload.departmentName }, { code }]
  });

  if (dept) return dept;

  dept = await Department.create({
    name: payload.departmentName,
    code,
    program: 'B.E.'
  });

  return dept;
};

const resolveRegulation = async (payload, startYear) => {
  if (payload.regulationId) {
    const regulation = await Regulation.findById(payload.regulationId);
    if (!regulation) throw new Error('Invalid regulationId');
    return regulation;
  }

  const resolvedStartYear = Number(payload.regulationStartYear || startYear);

  if (!resolvedStartYear) {
    throw new Error('regulationId or regulationStartYear required');
  }

  const regulationName = String(
    payload.regulationName || `R${resolvedStartYear}`
  )
    .trim()
    .toUpperCase();

  let regulation = await Regulation.findOne({
    $or: [{ name: regulationName }, { startYear: resolvedStartYear }]
  });

  if (!regulation) {
    regulation = await Regulation.create({
      name: regulationName,
      startYear: resolvedStartYear,
      totalSemesters: normalizeTotalSemesters(payload.totalSemesters)
    });
  }

  return regulation;
};

const resolveBatch = async (payload) => {
  if (payload.batchId) {
    const batch = await Batch.findById(payload.batchId);
    if (!batch) throw new Error('Invalid batchId');
    return batch;
  }

  const startYear = Number(payload.startYear || payload.admissionYear);
  const endYear = Number(payload.endYear);

  if (!startYear || !endYear) {
    throw new Error('Batch requires startYear and endYear');
  }

  const regulation = await resolveRegulation(payload, startYear);

  let batch = await Batch.findOne({
    startYear,
    endYear
  });

  if (batch) return batch;

  batch = await Batch.create({
    startYear,
    endYear,
    name: `${startYear}-${endYear}`,
    programDuration: Number(payload.programDuration) || 4
  });

  return batch;
};

const resolveBatchProgram = async (payload, batch, department, regulation) => {
  if (payload.batchProgramId) {
    const batchProgram = await BatchProgram.findById(payload.batchProgramId);
    if (!batchProgram) throw new Error('Invalid batchProgramId');
    return batchProgram;
  }

  let batchProgram = await BatchProgram.findOne({
    batchId: batch._id,
    departmentId: department._id
  });

  if (!batchProgram) {
    batchProgram = await BatchProgram.create({
      batchId: batch._id,
      departmentId: department._id,
      regulationId: regulation._id
    });
  }

  return batchProgram;
};

const resolveSection = async (
  payload,
  batchProgram,
  forceUnallocated = false
) => {
  if (!forceUnallocated && payload.sectionId) {
    const section = await Section.findById(payload.sectionId);
    if (!section) throw new Error('Invalid sectionId');
    return section;
  }

  const name = forceUnallocated
    ? DEFAULT_SECTION_NAME
    : payload.sectionName || DEFAULT_SECTION_NAME;

  const normalized = String(name).trim().toUpperCase();

  let section = await Section.findOne({
    batchProgramId: batchProgram._id,
    name: normalized
  });

  if (!section) {
    section = await Section.create({
      batchProgramId: batchProgram._id,
      name: normalized
    });
  }

  return section;
};

const resolveStudentContext = async (payload, forceUnallocated = false) => {
  const department = await resolveDepartment(payload);
  const startYear = Number(payload.startYear || payload.admissionYear);
  const regulation = await resolveRegulation(payload, startYear);
  const batch = await resolveBatch(payload);
  const batchProgram = await resolveBatchProgram(
    payload,
    batch,
    department,
    regulation
  );
  const section = await resolveSection(payload, batchProgram, forceUnallocated);

  return {
    departmentId: department._id,
    batchId: batch._id,
    sectionId: section._id,
    batchStartYear: batch.startYear
  };
};

const handleBadRequest = (res, error) => {
  if (
    /Invalid .*Id/i.test(error.message) ||
    /require/i.test(error.message) ||
    /already exists/i.test(error.message)
  ) {
    return res
      .status(400)
      .json({ success: false, message: error.message, data: {} });
  }

  return res
    .status(500)
    .json({ success: false, message: error.message, data: {} });
};

export const addStudent = async (req, res) => {
  try {
    const {
      email,
      password,
      gender,
      dateOfBirth,
      firstName,
      lastName,
      registerNumber,
      rollNumber,
      semesterNumber,
      admissionYear
    } = req.body;

    if (!email || !password || !registerNumber || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message:
          'email, password, registerNumber, firstName, lastName required',
        data: {}
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedRegisterNumber = String(registerNumber)
      .toUpperCase()
      .trim();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
        data: {}
      });
    }

    const existingStudent = await Student.findOne({
      registerNumber: normalizedRegisterNumber
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Register Number already exists',
        data: {}
      });
    }

    const context = await resolveStudentContext(req.body, true);
    const normalizedSemesterNumber = Number(semesterNumber) || 1;
    const finalAdmissionYear =
      Number(admissionYear) ||
      context.batchStartYear ||
      new Date().getFullYear();

    const user = await User.create({
      email: normalizedEmail,
      password,
      role: 'STUDENT',
      gender,
      dateOfBirth
    });

    const student = await Student.create({
      userId: user._id,
      departmentId: context.departmentId,
      batchId: context.batchId,
      sectionId: context.sectionId,
      firstName,
      lastName,
      registerNumber: normalizedRegisterNumber,
      rollNumber,
      admissionYear: finalAdmissionYear,
      semesterNumber: normalizedSemesterNumber,
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: { student }
    });
  } catch (error) {
    return handleBadRequest(res, error);
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid student id', data: {} });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: 'Student not found', data: {} });
    }

    const user = await User.findById(student.userId);

    if (req.body.registerNumber !== undefined) {
      const normalizedRegisterNumber = String(req.body.registerNumber)
        .toUpperCase()
        .trim();

      const duplicate = await Student.findOne({
        registerNumber: normalizedRegisterNumber,
        _id: { $ne: id }
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Register Number already exists',
          data: {}
        });
      }

      req.body.registerNumber = normalizedRegisterNumber;
    }

    const objectIdFields = ['departmentId', 'batchId', 'sectionId'];

    for (const field of objectIdFields) {
      if (
        req.body[field] !== undefined &&
        !mongoose.Types.ObjectId.isValid(req.body[field])
      ) {
        return res
          .status(400)
          .json({ success: false, message: `Invalid ${field}`, data: {} });
      }
    }

    const studentFields = [
      'firstName',
      'lastName',
      'registerNumber',
      'rollNumber',
      'departmentId',
      'batchId',
      'sectionId',
      'semesterNumber',
      'status',
      'entryType',
      'admissionYear'
    ];

    studentFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        student[field] = req.body[field];
      }
    });

    await student.save();

    if (user) {
      if (req.body.password) user.password = req.body.password;
      if (req.body.gender) user.gender = req.body.gender;
      if (req.body.dateOfBirth) user.dateOfBirth = req.body.dateOfBirth;

      await user.save();
    }

    return res.json({
      success: true,
      message: 'Student updated successfully',
      data: { student }
    });
  } catch (error) {
    return handleBadRequest(res, error);
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid student id', data: {} });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: 'Student not found', data: {} });
    }

    await User.findByIdAndDelete(student.userId);
    await Student.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Student deleted successfully',
      data: {}
    });
  } catch (error) {
    return handleBadRequest(res, error);
  }
};

export const getAllStudents = async (req, res) => {
  try {
    const filter = {};

    if (req.query.departmentId) {
      filter.departmentId = toObjectId(req.query.departmentId, 'departmentId');
    }

    if (req.query.batchId) {
      filter.batchId = toObjectId(req.query.batchId, 'batchId');
    }

    if (req.query.sectionId) {
      filter.sectionId = toObjectId(req.query.sectionId, 'sectionId');
    }

    if (req.query.status) {
      filter.status = String(req.query.status).toLowerCase();
    }

    if (req.query.admissionYear) {
      filter.admissionYear = Number(req.query.admissionYear);
    }

    const students = await Student.find(filter)
      .populate('userId', 'email gender dateOfBirth isActive')
      .populate('departmentId', 'name code program')
      .populate('batchId', 'name startYear endYear regulationId')
      .populate('sectionId', 'name capacity isActive');

    return res.json({
      success: true,
      message: 'Students fetched successfully',
      data: { students }
    });
  } catch (error) {
    return handleBadRequest(res, error);
  }
};

export const updateStudentSemester = async (req, res) => {
  try {
    const { id } = req.params;
    const { semesterNumber } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid student id', data: {} });
    }

    const normalizedSemesterNumber = Number(semesterNumber);

    if (
      !Number.isInteger(normalizedSemesterNumber) ||
      normalizedSemesterNumber < 1 ||
      normalizedSemesterNumber > 12
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid semesterNumber', data: {} });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: 'Student not found', data: {} });
    }

    student.semesterNumber = normalizedSemesterNumber;
    await student.save();

    return res.json({
      success: true,
      message: 'Student semester updated successfully',
      data: { student }
    });
  } catch (error) {
    return handleBadRequest(res, error);
  }
};

export const uploadMultipleStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'No file uploaded', data: {} });
    }

    const workbook = req.file.buffer
      ? xlsx.read(req.file.buffer, { type: 'buffer' })
      : xlsx.readFile(req.file.path);

    const sheet = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const {
          email,
          password,
          firstName,
          lastName,
          registerNumber,
          semesterNumber,
          admissionYear
        } = row;

        if (!email || !firstName || !lastName || !registerNumber) {
          failed++;
          continue;
        }

        const normalizedEmail = String(email).toLowerCase().trim();
        const normalizedRegister = String(registerNumber).toUpperCase().trim();

        const [existingUser, existingStudent] = await Promise.all([
          User.findOne({ email: normalizedEmail }),
          Student.findOne({ registerNumber: normalizedRegister })
        ]);

        if (existingUser || existingStudent) {
          skipped++;
          continue;
        }

        const context = await resolveStudentContext(row, true);
        const normalizedSemesterNumber = Number(semesterNumber) || 1;
        const finalAdmissionYear =
          Number(admissionYear) ||
          context.batchStartYear ||
          new Date().getFullYear();

        const user = await User.create({
          email: normalizedEmail,
          password: password || '123456',
          role: 'STUDENT'
        });

        await Student.create({
          userId: user._id,
          departmentId: context.departmentId,
          batchId: context.batchId,
          sectionId: context.sectionId,
          firstName,
          lastName,
          registerNumber: normalizedRegister,
          admissionYear: finalAdmissionYear,
          semesterNumber: normalizedSemesterNumber,
          status: 'active'
        });

        inserted++;
      } catch (error) {
        failed++;
      }
    }

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
    return handleBadRequest(res, error);
  }
};

export const getStudentStats = async (req, res) => {
  try {
    const { departmentId } = req.query;

    const filter = {};

    if (departmentId) {
      filter.departmentId = toObjectId(departmentId, 'departmentId');
    }

    const students = await Student.find(filter);

    const yearMap = { 1: 0, 2: 0, 3: 0, 4: 0 };

    students.forEach((student) => {
      const year = getYearFromSemester(student.semesterNumber);
      if (year) yearMap[year]++;
    });

    const totalStudents = yearMap[1] + yearMap[2] + yearMap[3] + yearMap[4];

    return res.json({
      success: true,
      message: 'Student stats fetched successfully',
      data: {
        totalStudents,
        yearWise: {
          firstYear: yearMap[1],
          secondYear: yearMap[2],
          thirdYear: yearMap[3],
          fourthYear: yearMap[4]
        }
      }
    });
  } catch (error) {
    return handleBadRequest(res, error);
  }
};

export const getStudentDepartmentWise = async (req, res) => {
  try {
    const students = await Student.aggregate([
      {
        $lookup: {
          from: 'departments',
          localField: 'departmentId',
          foreignField: '_id',
          as: 'department'
        }
      },
      { $unwind: '$department' }
    ]);

    const grouped = {};

    students.forEach((student) => {
      const year = getYearFromSemester(student.semesterNumber);
      if (!year) return;

      const deptId = String(student.departmentId);

      if (!grouped[deptId]) {
        grouped[deptId] = {
          departmentId: student.departmentId,
          department: student.department.name,
          totalStudents: 0,
          yearWise: {
            firstYear: 0,
            secondYear: 0,
            thirdYear: 0,
            fourthYear: 0
          }
        };
      }

      grouped[deptId].totalStudents++;

      if (year === 1) grouped[deptId].yearWise.firstYear++;
      if (year === 2) grouped[deptId].yearWise.secondYear++;
      if (year === 3) grouped[deptId].yearWise.thirdYear++;
      if (year === 4) grouped[deptId].yearWise.fourthYear++;
    });

    const data = Object.values(grouped);

    return res.json({
      success: true,
      message: 'Department-wise student stats fetched successfully',
      data: {
        totalDepartments: data.length,
        departments: data
      }
    });
  } catch (error) {
    return handleBadRequest(res, error);
  }
};
