import Student from '../models/Student.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import AcademicYear from '../models/AcademicYear.js';
import Batch from '../models/Batch.js';
import Section from '../models/Section.js';
import mongoose from 'mongoose';
import xlsx from 'xlsx';

const DEFAULT_SECTION_NAME = 'UNALLOCATED';

const normalizeCode = (value) => {
  if (!value) return '';
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
};

const getAcademicYearParts = (payload) => {
  const rawAcademicYear = payload.academicYear || {};

  const name =
    payload.academicYearName ||
    rawAcademicYear.name ||
    (typeof rawAcademicYear === 'string' ? rawAcademicYear : undefined);

  let startYear =
    Number(payload.startYear || rawAcademicYear.startYear) || undefined;
  let endYear = Number(payload.endYear || rawAcademicYear.endYear) || undefined;

  if ((!startYear || !endYear) && name) {
    const match = String(name).match(/(\d{4})\D+(\d{4})/);
    if (match) {
      startYear = Number(match[1]);
      endYear = Number(match[2]);
    }
  }

  if (startYear && !endYear) {
    endYear = startYear + 1;
  }

  return {
    name:
      name || (startYear && endYear ? `${startYear}-${endYear}` : undefined),
    startYear,
    endYear
  };
};

const resolveDepartment = async (payload) => {
  if (payload.departmentId) {
    const department = await Department.findById(payload.departmentId);
    if (!department) throw new Error('Invalid departmentId');
    return department;
  }

  const rawDepartment = payload.department || {};
  const name = payload.departmentName || rawDepartment.name;

  if (!name) {
    throw new Error('departmentId or departmentName is required');
  }

  const code = normalizeCode(
    payload.departmentCode ||
      rawDepartment.code ||
      rawDepartment.shortName ||
      name
  );

  const existing = await Department.findOne({
    $or: [{ name }, ...(code ? [{ code }] : [])]
  });

  if (existing) return existing;

  return Department.create({
    name,
    code: code || normalizeCode(name),
    shortName: rawDepartment.shortName,
    program: rawDepartment.program || payload.program || 'B.E',
    isActive: true
  });
};

const resolveAcademicYear = async (payload) => {
  if (payload.academicYearId) {
    const academicYear = await AcademicYear.findById(payload.academicYearId);
    if (!academicYear) throw new Error('Invalid academicYearId');
    return academicYear;
  }

  const { name, startYear, endYear } = getAcademicYearParts(payload);

  if (!name && (!startYear || !endYear)) {
    const currentAcademicYear = await AcademicYear.findOne({
      isCurrent: true,
      isActive: true
    });

    if (currentAcademicYear) return currentAcademicYear;

    throw new Error(
      'academicYearId or academicYear details (academicYearName/startYear/endYear) are required'
    );
  }

  const existing = await AcademicYear.findOne({
    $or: [
      ...(name ? [{ name }] : []),
      ...(startYear && endYear ? [{ startYear, endYear }] : [])
    ]
  });

  if (existing) return existing;

  return AcademicYear.create({
    name: name || `${startYear}-${endYear}`,
    startYear,
    endYear,
    isCurrent: false,
    isActive: true
  });
};

const resolveBatch = async (payload, department, academicYear) => {
  if (payload.batchId) {
    const batch = await Batch.findById(payload.batchId);
    if (!batch) throw new Error('Invalid batchId');
    return batch;
  }

  const rawBatch = payload.batch || {};
  const admissionYear =
    Number(payload.admissionYear || rawBatch.admissionYear) ||
    academicYear.startYear;
  const programDuration =
    Number(payload.programDuration || rawBatch.programDuration) || 4;
  const graduationYear =
    Number(payload.graduationYear || rawBatch.graduationYear) ||
    admissionYear + programDuration;

  const existing = await Batch.findOne({
    departmentId: department._id,
    admissionYear,
    graduationYear
  });

  if (existing) return existing;

  const batchName =
    payload.batchName || rawBatch.name || `${department.code}-${admissionYear}`;

  return Batch.create({
    name: batchName,
    departmentId: department._id,
    admissionYear,
    graduationYear,
    programDuration,
    isActive: true
  });
};

const resolveSection = async (payload, batch, forceUnallocated = false) => {
  if (!forceUnallocated && payload.sectionId) {
    const section = await Section.findById(payload.sectionId);
    if (!section) throw new Error('Invalid sectionId');
    return section;
  }

  const rawSection = payload.section || {};
  const targetName = forceUnallocated
    ? DEFAULT_SECTION_NAME
    : payload.sectionName || rawSection.name || DEFAULT_SECTION_NAME;

  const normalizedName = String(targetName).trim().toUpperCase();

  let section = await Section.findOne({
    batchId: batch._id,
    name: normalizedName
  });

  if (!section) {
    section = await Section.create({
      name: normalizedName,
      batchId: batch._id,
      isActive: true
    });
  }

  return section;
};

const resolveStudentAcademicContext = async (
  payload,
  forceUnallocated = false
) => {
  const department = await resolveDepartment(payload);
  const academicYear = await resolveAcademicYear(payload);
  const batch = await resolveBatch(payload, department, academicYear);
  const section = await resolveSection(payload, batch, forceUnallocated);

  return {
    departmentId: department._id,
    academicYearId: academicYear._id,
    batchId: batch._id,
    sectionId: section._id
  };
};

/* ======================================================
   CREATE STUDENT (Manual)
====================================================== */
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
      semesterNumber
    } = req.body;

    if (!email || !password || !registerNumber || !firstName || !lastName) {
      return res.status(400).json({
        message: 'email, password, registerNumber, firstName, lastName required'
      });
    }

    /* 1️⃣ Prevent duplicate email */
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email'
      });
    }

    /* 2️⃣ Prevent duplicate register number */
    const existingStudent = await Student.findOne({ registerNumber });

    if (existingStudent) {
      return res.status(400).json({
        message: 'Register Number already exists'
      });
    }

    const context = await resolveStudentAcademicContext(req.body, true);

    /* 3️⃣ Create User */
    const user = await User.create({
      email,
      password,
      role: 'STUDENT',
      gender,
      dateOfBirth,
      profileType: 'Student'
    });

    /* 4️⃣ Create Student Profile */
    const student = await Student.create({
      userId: user._id,
      departmentId: context.departmentId,
      batchId: context.batchId,
      firstName,
      lastName,
      registerNumber,
      rollNumber,
      academicHistory: [
        {
          academicYearId: context.academicYearId,
          semesterNumber: Number(semesterNumber) || 1,
          sectionId: context.sectionId,
          isCurrent: true
        }
      ]
    });

    /* 5️⃣ Link profile to user */
    user.profileRef = student._id;
    await user.save();

    res.status(201).json({
      message: 'Student created successfully',
      student
    });
  } catch (error) {
    console.error('Add Student Error:', error);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   UPDATE STUDENT
====================================================== */
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);

    if (!student) return res.status(404).json({ message: 'Student not found' });

    const user = await User.findById(student.userId);

    /* Update Student fields */
    const studentFields = [
      'firstName',
      'lastName',
      'registerNumber',
      'rollNumber',
      'departmentId',
      'batchId',
      'entryType',
      'academicStatus'
    ];

    studentFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        student[field] = req.body[field];
      }
    });

    await student.save();

    /* Update User fields */
    if (user) {
      if (req.body.password) user.password = req.body.password;
      if (req.body.gender) user.gender = req.body.gender;
      if (req.body.dateOfBirth) user.dateOfBirth = req.body.dateOfBirth;

      await user.save();
    }

    res.json({
      message: 'Student updated successfully',
      student
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   DELETE STUDENT
====================================================== */
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);

    if (!student) return res.status(404).json({ message: 'Student not found' });

    await User.findByIdAndDelete(student.userId);
    await Student.findByIdAndDelete(id);

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   GET ALL STUDENTS
====================================================== */
export const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate('userId', 'email gender dateOfBirth isActive')
      .populate('departmentId')
      .populate('batchId')
      .populate('academicHistory.sectionId')
      .populate('academicHistory.academicYearId');

    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   FILTER STUDENTS
====================================================== */
export const getStudentsFiltered = async (req, res) => {
  try {
    const { departmentId, batchId, sectionId } = req.query;

    const filter = {};

    if (departmentId) filter.departmentId = departmentId;
    if (batchId) filter.batchId = batchId;

    if (sectionId) {
      filter.academicHistory = {
        $elemMatch: {
          sectionId,
          isCurrent: true
        }
      };
    }

    const students = await Student.find(filter)
      .populate('userId', 'email')
      .populate('departmentId')
      .populate('batchId');

    res.json({
      total: students.length,
      students
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   SECTION TRANSFER (NEW STRUCTURE)
====================================================== */
export const swapStudentSection = async (req, res) => {
  try {
    const { studentIds, newSectionId, academicYearId, semesterNumber } =
      req.body;

    if (!studentIds || studentIds.length === 0) {
      return res.status(400).json({
        message: 'No students selected'
      });
    }

    const students = await Student.find({ _id: { $in: studentIds } });

    for (const student of students) {
      /* Remove previous current flag */
      student.academicHistory.forEach((h) => {
        if (h.isCurrent) h.isCurrent = false;
      });

      /* Add new history entry */
      student.academicHistory.push({
        academicYearId,
        semesterNumber,
        sectionId: newSectionId,
        isCurrent: true
      });

      await student.save();
    }

    res.json({
      message: `Moved ${students.length} students`,
      moved: students.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   BULK UPLOAD STUDENTS (Excel)
====================================================== */
export const uploadMultipleStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const workbook = req.file.buffer
      ? xlsx.read(req.file.buffer, { type: 'buffer' })
      : xlsx.readFile(req.file.path);
    const sheet = workbook.SheetNames[0];

    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

    let inserted = 0;

    for (const row of rows) {
      const {
        email,
        password,
        firstName,
        lastName,
        registerNumber,
        semesterNumber
      } = row;

      const existing = await User.findOne({ email });

      if (existing) continue;

      const context = await resolveStudentAcademicContext(row, true);

      const user = await User.create({
        email,
        password: password || '123456',
        role: 'STUDENT',
        profileType: 'Student'
      });

      const student = await Student.create({
        userId: user._id,
        departmentId: context.departmentId,
        batchId: context.batchId,
        firstName,
        lastName,
        registerNumber,
        academicHistory: [
          {
            academicYearId: context.academicYearId,
            semesterNumber: Number(semesterNumber) || 1,
            sectionId: context.sectionId,
            isCurrent: true
          }
        ]
      });

      user.profileRef = student._id;
      await user.save();

      inserted++;
    }

    res.json({
      message: 'Upload completed',
      inserted
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   DEPARTMENT-WISE STUDENT COUNT 
====================================================== */
export const getStudentDepartmentWise = async (req, res) => {
  try {
    const data = await Student.aggregate([
      {
        $group: {
          _id: '$departmentId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department'
        }
      },
      { $unwind: '$department' },
      {
        $project: {
          _id: 0,
          department: '$department.name',
          count: 1
        }
      }
    ]);

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   STUDENTS STATS (COUNT - YEAR WISE FOR A DEPARTMENT)
====================================================== */
export const getStudentStats = async (req, res) => {
  try {
    const { departmentId } = req.query;

    const matchStage = {};

    if (departmentId) {
      matchStage.departmentId = new mongoose.Types.ObjectId(departmentId);
    }

    const students = await Student.aggregate([
      { $match: matchStage },

      {
        $lookup: {
          from: 'batches',
          localField: 'batchId',
          foreignField: '_id',
          as: 'batch'
        }
      },

      { $unwind: '$batch' },

      {
        $group: {
          _id: '$batch.yearNumber', // assuming batch has yearNumber: 1,2,3,4
          count: { $sum: 1 }
        }
      }
    ]);

    const totalStudents = await Student.countDocuments(matchStage);

    const yearMap = {
      1: 0,
      2: 0,
      3: 0,
      4: 0
    };

    students.forEach((y) => {
      yearMap[y._id] = y.count;
    });

    res.json({
      totalStudents,
      yearWise: {
        firstYear: yearMap[1],
        secondYear: yearMap[2],
        thirdYear: yearMap[3],
        fourthYear: yearMap[4]
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   DEPARTMENT SUMMARY
====================================================== */
export const getDepartmentSummary = async (req, res) => {
  try {
    const departmentId = req.user.departmentId;

    if (!departmentId) {
      return res.status(400).json({
        message: 'Department missing in token'
      });
    }

    const students = await Student.find({
      departmentId
    })
      .populate('academicHistory.sectionId')
      .populate('academicHistory.academicYearId');

    const summary = {
      departmentId,
      totalStudents: students.length,
      sections: {}
    };

    students.forEach((student) => {
      const current = student.academicHistory.find((h) => h.isCurrent === true);

      if (!current) return;

      const sectionName = current.sectionId?.name || 'Unknown';

      if (!summary.sections[sectionName]) {
        summary.sections[sectionName] = {
          count: 0,
          students: []
        };
      }

      summary.sections[sectionName].count++;
      summary.sections[sectionName].students.push(student);
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
