import mongoose from 'mongoose';
import xlsx from 'xlsx';
import Student from '../models/Student.js';
import User from '../models/User.js';
import StudentAcademicRecord from '../models/StudentAcademicRecord.js';
import AcademicYear from '../models/AcademicYear.js';
import Department from '../models/Department.js';
import Batch from '../models/Batch.js';
import BatchProgram from '../models/BatchProgram.js';
import Section from '../models/Section.js';
import AppError from '../utils/AppError.js';
import StudentHelper from '../utils/StudentHelper.js';

export const addStudent = async (req, res, next) => {
  let session;

  try {
    const {
      email,
      password,
      firstName,
      lastName,
      registerNumber,
      rollNumber,
      semesterNumber,
      departmentId,
      batchId,
      sectionId,
      gender,
      dateOfBirth
    } = req.body;

    if (!email || !password || !firstName || !lastName || !registerNumber) {
      throw new AppError(
        'email, password, firstName, lastName, and registerNumber are required',
        400
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedRegister = String(registerNumber).toUpperCase().trim();

    // ======================================
    // PARALLEL DUPLICATE CHECKS (FASTER)
    // ======================================
    const [existingUser, existingStudent] = await Promise.all([
      User.findOne({ email: normalizedEmail }).select('_id'),
      Student.findOne({ registerNumber: normalizedRegister }).select('_id')
    ]);

    if (existingUser) {
      throw new AppError('User already exists with this email', 400);
    }

    if (existingStudent) {
      throw new AppError(
        'Student with this registerNumber already exists',
        400
      );
    }

    // ======================================
    // RESOLVE CONTEXT
    // ======================================
    const { section, batch } = await StudentHelper.resolveContext(
      departmentId,
      batchId,
      sectionId
    );

    // ======================================
    // SECTION CAPACITY VALIDATION
    // ======================================
    const currentStudentCount = await Student.countDocuments({
      sectionId: section._id,
      status: 'active'
    });

    if (currentStudentCount >= section.capacity) {
      throw new AppError(
        `Section ${section.name} has reached its capacity`,
        400
      );
    }

    const activeAcademicYear = await StudentHelper.getActiveAcademicYear();

    const finalSemesterNumber = Number(semesterNumber) || 1;

    // ======================================
    // SEMESTER VALIDATION
    // ======================================
    const yearDifference = activeAcademicYear.startYear - batch.startYear;
    const maxAllowedSemester = yearDifference * 2 + 2;

    if (finalSemesterNumber < 1 || finalSemesterNumber > maxAllowedSemester) {
      throw new AppError(
        'Invalid semester for selected batch and academic year',
        400
      );
    }

    // ======================================
    // START TRANSACTION (WRITES ONLY)
    // ======================================
    session = await mongoose.startSession();
    session.startTransaction();

    const userId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();

    // 1️⃣ Create User
    await User.create(
      [
        {
          _id: userId,
          email: normalizedEmail,
          password,
          role: 'STUDENT',
          gender,
          dateOfBirth
        }
      ],
      { session }
    );

    // 2️⃣ Create Student
    await Student.create(
      [
        {
          _id: studentId,
          userId,
          departmentId,
          batchId,
          sectionId: section._id,
          firstName,
          lastName,
          registerNumber: normalizedRegister,
          rollNumber,
          semesterNumber: finalSemesterNumber,
          status: 'active'
        }
      ],
      { session }
    );

    // 3️⃣ Create Academic Record
    await StudentAcademicRecord.create(
      [
        {
          studentId,
          academicYearId: activeAcademicYear._id,
          semesterNumber: finalSemesterNumber,
          sectionId: section._id,
          status: 'active'
        }
      ],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        studentId
      }
    });
  } catch (error) {
    if (session) await session.abortTransaction();
    return next(StudentHelper.mapToAppError(error));
  } finally {
    if (session) session.endSession();
  }
};

export const updateStudent = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      throw new AppError('Invalid student ID', 400);

    const student = await Student.findById(id).session(session);
    if (!student) throw new AppError('Student not found', 404);

    const user = await User.findById(student.userId)
      .select('+password')
      .session(session);
    if (!user) throw new AppError('Linked user not found for student', 404);

    // Update linked user fields when provided
    if (updateData.email !== undefined) {
      const normalizedEmail = String(updateData.email).toLowerCase().trim();
      if (!normalizedEmail) throw new AppError('Email cannot be empty', 400);

      if (normalizedEmail !== user.email) {
        const duplicateUser = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: user._id }
        }).session(session);

        if (duplicateUser) throw new AppError('Email already in use', 400);
      }

      user.email = normalizedEmail;
    }

    if (updateData.password !== undefined) {
      const password = String(updateData.password);
      if (password.trim().length < 6) {
        throw new AppError('Password must be at least 6 characters', 400);
      }
      user.password = password;
    }

    if (updateData.gender !== undefined) {
      const allowedGenders = ['Male', 'Female', 'Other'];
      if (!allowedGenders.includes(updateData.gender)) {
        throw new AppError('Invalid gender value', 400);
      }
      user.gender = updateData.gender;
    }

    if (updateData.dateOfBirth !== undefined) {
      if (updateData.dateOfBirth === null || updateData.dateOfBirth === '') {
        user.dateOfBirth = undefined;
      } else {
        const parsedDate = new Date(updateData.dateOfBirth);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new AppError('Invalid dateOfBirth', 400);
        }
        user.dateOfBirth = parsedDate;
      }
    }

    if (updateData.isActive !== undefined) {
      if (typeof updateData.isActive !== 'boolean') {
        throw new AppError('isActive must be a boolean value', 400);
      }
      user.isActive = updateData.isActive;
    }

    // Handle Register Number Change
    if (updateData.registerNumber) {
      const normalizedReg = String(updateData.registerNumber)
        .toUpperCase()
        .trim();
      if (normalizedReg !== student.registerNumber) {
        const duplicate = await Student.findOne({
          registerNumber: normalizedReg
        }).session(session);
        if (duplicate)
          throw new AppError('Register Number already in use', 400);
        student.registerNumber = normalizedReg;
      }
    }

    // Identify state changes before overwriting
    const oldSemester = student.semesterNumber;
    let newSemester = oldSemester;

    // MERGED LOGIC: Strict semester validation from updateStudentSemester
    if (updateData.semesterNumber !== undefined) {
      newSemester = Number(updateData.semesterNumber);
      if (!newSemester || newSemester < 1) {
        throw new AppError('Invalid semester number', 400);
      }
    }

    const isSectionChanged =
      updateData.sectionId &&
      String(updateData.sectionId) !== String(student.sectionId);
    const isSemesterChanged = oldSemester !== newSemester;

    // Validate relationships if changed
    const finalDeptId = updateData.departmentId || student.departmentId;
    const finalBatchId = updateData.batchId || student.batchId;
    const finalSectionId = updateData.sectionId || student.sectionId;

    if (updateData.departmentId || updateData.batchId || updateData.sectionId) {
      await StudentHelper.resolveContext(
        finalDeptId,
        finalBatchId,
        finalSectionId
      );
    }

    // Update Student Fields
    const allowedFields = [
      'firstName',
      'lastName',
      'rollNumber',
      'departmentId',
      'batchId',
      'sectionId',
      'semesterNumber', // This now handles semester updates dynamically
      'entryType',
      'status'
    ];
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) student[field] = updateData[field];
    });

    await Promise.all([student.save({ session }), user.save({ session })]);

    const activeAcademicYear = await StudentHelper.getActiveAcademicYear();

    // RULE 4: SEMESTER CORRECTION HANDLING (Merged Flow)
    if (isSemesterChanged) {
      // First, ensure we don't violate the unique index for the target semester
      const targetRecordExists = await StudentAcademicRecord.findOne({
        studentId: student._id,
        academicYearId: activeAcademicYear._id,
        semesterNumber: newSemester
      }).session(session);

      if (!targetRecordExists) {
        // Find the record for the OLD semester in the active year
        const oldRecord = await StudentAcademicRecord.findOne({
          studentId: student._id,
          academicYearId: activeAcademicYear._id,
          semesterNumber: oldSemester
        }).session(session);

        if (oldRecord) {
          // Case A: Record exists -> Correct the semester (and section if changed)
          oldRecord.semesterNumber = newSemester;
          if (isSectionChanged) oldRecord.sectionId = student.sectionId;
          await oldRecord.save({ session });
        } else {
          // Case B: Record does not exist -> Create new preserving uniqueness
          await StudentAcademicRecord.create(
            [
              {
                studentId: student._id,
                academicYearId: activeAcademicYear._id,
                semesterNumber: newSemester,
                sectionId: student.sectionId,
                status: 'active'
              }
            ],
            { session }
          );
        }
      } else if (isSectionChanged) {
        // If target record already existed, just update section if needed
        targetRecordExists.sectionId = student.sectionId;
        await targetRecordExists.save({ session });
      }
    }
    // RULE 3: SECTION CHANGE HANDLING (Same Semester)
    else if (isSectionChanged) {
      const currentRecord = await StudentAcademicRecord.findOne({
        studentId: student._id,
        academicYearId: activeAcademicYear._id,
        semesterNumber: oldSemester
      }).session(session);

      if (currentRecord) {
        currentRecord.sectionId = student.sectionId;
        await currentRecord.save({ session });
      }
    }

    await session.commitTransaction();
    return res.json({
      success: true,
      message: 'Student updated successfully',
      data: { student }
    });
  } catch (error) {
    await session.abortTransaction();
    return next(StudentHelper.mapToAppError(error));
  } finally {
    session.endSession();
  }
};

export const deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw new AppError('Invalid student ID', 400);

    const student = await Student.findById(id);
    if (!student) throw new AppError('Student not found', 404);

    const user = await User.findById(student.userId);
    if (user) {
      user.isActive = false;
      await user.save({ validateBeforeSave: false });
    }

    await StudentAcademicRecord.deleteMany({ studentId: id });
    await Student.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Student deleted successfully',
      data: {}
    });
  } catch (error) {
    return next(StudentHelper.mapToAppError(error));
  }
};

export const uploadMultipleStudents = async (req, res, next) => {
  let session;

  try {
    if (!req.file) throw new AppError('No file uploaded', 400);

    const workbook = req.file.buffer
      ? xlsx.read(req.file.buffer, { type: 'buffer' })
      : xlsx.readFile(req.file.path);

    const sheet = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

    if (!rows.length) {
      throw new AppError('The uploaded Excel file is empty', 400);
    }

    const activeAcademicYear = await StudentHelper.getActiveAcademicYear();

    // ===============================
    // PREFETCH CONFIG DATA
    // ===============================

    const [departments, batches, batchPrograms, sections] = await Promise.all([
      Department.find(),
      Batch.find(),
      BatchProgram.find(),
      Section.find()
    ]);

    const deptMap = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
    const batchMap = new Map(batches.map((b) => [b.name, b]));

    // Map BatchProgram -> Sections
    const bpSectionsMap = new Map();
    for (const bp of batchPrograms) {
      const bpSecs = sections.filter(
        (s) => s.batchProgramId.toString() === bp._id.toString()
      );
      bpSectionsMap.set(bp._id.toString(), bpSecs);
    }

    // ===============================
    // PREFETCH EXISTING USERS
    // ===============================

    const emails = rows.map((r) => String(r.email).toLowerCase().trim());
    const registers = rows.map((r) =>
      String(r.registerNumber).toUpperCase().trim()
    );

    const [existingUsers, existingStudents] = await Promise.all([
      User.find({ email: { $in: emails } }).select('email'),
      Student.find({ registerNumber: { $in: registers } }).select(
        'registerNumber'
      )
    ]);

    const emailSet = new Set(existingUsers.map((u) => u.email));
    const registerSet = new Set(existingStudents.map((s) => s.registerNumber));

    // ===============================
    // SECTION STUDENT COUNTS
    // ===============================

    const studentCounts = await Student.aggregate([
      { $match: { status: 'active', sectionId: { $ne: null } } },
      { $group: { _id: '$sectionId', count: { $sum: 1 } } }
    ]);

    const sectionCountMap = new Map(
      studentCounts.map((c) => [c._id.toString(), c.count])
    );

    // ===============================
    // ARRAYS FOR BULK INSERT
    // ===============================

    const users = [];
    const students = [];
    const academicRecords = [];

    let rowIndex = 2;

    for (const row of rows) {
      const {
        firstName,
        lastName,
        registerNumber,
        rollNumber,
        semesterNumber,
        email,
        gender,
        dateOfBirth,
        departmentCode,
        batchName
      } = row;

      if (
        !email ||
        !firstName ||
        !lastName ||
        !registerNumber ||
        !departmentCode ||
        !batchName
      ) {
        throw new AppError(`Row ${rowIndex}: Missing required fields`, 400);
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const normalizedRegister = String(registerNumber).toUpperCase().trim();
      const normDeptCode = String(departmentCode).toUpperCase().trim();
      const normBatchName = String(batchName).trim();

      if (emailSet.has(normalizedEmail)) {
        throw new AppError(`Row ${rowIndex}: Email already exists`, 400);
      }

      if (registerSet.has(normalizedRegister)) {
        throw new AppError(
          `Row ${rowIndex}: Register number already exists`,
          400
        );
      }

      const department = deptMap.get(normDeptCode);
      const batch = batchMap.get(normBatchName);

      if (!department) {
        throw new AppError(`Row ${rowIndex}: Invalid department code`, 400);
      }

      if (!batch) {
        throw new AppError(`Row ${rowIndex}: Invalid batch`, 400);
      }

      // Semester validation
      const finalSem = Number(semesterNumber) || 1;
      const yearDiff = activeAcademicYear.startYear - batch.startYear;
      const maxSemester = yearDiff * 2 + 2;

      if (finalSem < 1 || finalSem > maxSemester) {
        throw new AppError(
          `Row ${rowIndex}: Invalid semester ${finalSem}`,
          400
        );
      }

      // Find batch program
      const batchProgram = batchPrograms.find(
        (bp) =>
          bp.departmentId.toString() === department._id.toString() &&
          bp.batchId.toString() === batch._id.toString()
      );

      if (!batchProgram) {
        throw new AppError(`Row ${rowIndex}: BatchProgram not configured`, 400);
      }

      const availableSections =
        bpSectionsMap.get(batchProgram._id.toString()) || [];

      const standardSections = availableSections
        .filter((s) => s.name !== 'UNALLOCATED')
        .sort((a, b) => a.name.localeCompare(b.name));

      let assignedSection = null;

      for (const sec of standardSections) {
        const currentCount = sectionCountMap.get(sec._id.toString()) || 0;

        if (currentCount < sec.capacity) {
          assignedSection = sec;
          sectionCountMap.set(sec._id.toString(), currentCount + 1);
          break;
        }
      }

      if (!assignedSection) {
        assignedSection = availableSections.find(
          (s) => s.name === 'UNALLOCATED'
        );
      }

      const userId = new mongoose.Types.ObjectId();
      const studentId = new mongoose.Types.ObjectId();

      users.push({
        _id: userId,
        email: normalizedEmail,
        password: row.password || '123456',
        role: 'STUDENT',
        gender,
        dateOfBirth
      });

      students.push({
        _id: studentId,
        userId,
        departmentId: department._id,
        batchId: batch._id,
        sectionId: assignedSection._id,
        firstName,
        lastName,
        registerNumber: normalizedRegister,
        rollNumber,
        semesterNumber: finalSem,
        status: 'active'
      });

      academicRecords.push({
        studentId,
        academicYearId: activeAcademicYear._id,
        semesterNumber: finalSem,
        sectionId: assignedSection._id,
        status: 'active'
      });

      emailSet.add(normalizedEmail);
      registerSet.add(normalizedRegister);

      rowIndex++;
    }

    // ===============================
    // TRANSACTION (WRITE ONLY)
    // ===============================

    session = await mongoose.startSession();
    session.startTransaction();

    await User.insertMany(users, { session });
    await Student.insertMany(students, { session });
    await StudentAcademicRecord.insertMany(academicRecords, { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Upload completed successfully',
      data: { inserted: students.length }
    });
  } catch (error) {
    if (session) await session.abortTransaction();
    return next(StudentHelper.mapToAppError(error));
  } finally {
    if (session) session.endSession();
  }
};

export const getAllStudents = async (req, res, next) => {
  try {
    const {
      academicYearId,
      semesterNumber,
      departmentId,
      batchId,
      sectionId,
      status
    } = req.query;

    const recordStatus = status ? String(status).toLowerCase() : 'active';

    let students;

    if (academicYearId) {
      const matchStage = {
        academicYearId: StudentHelper.toObjectId(
          academicYearId,
          'academicYearId'
        ),
        status: recordStatus
      };

      if (semesterNumber) matchStage.semesterNumber = Number(semesterNumber);

      const studentMatchStage = {};
      if (departmentId)
        studentMatchStage['student.departmentId'] = StudentHelper.toObjectId(
          departmentId,
          'departmentId'
        );
      if (batchId)
        studentMatchStage['student.batchId'] = StudentHelper.toObjectId(
          batchId,
          'batchId'
        );
      if (sectionId)
        studentMatchStage['student.sectionId'] = StudentHelper.toObjectId(
          sectionId,
          'sectionId'
        );
      if (status)
        studentMatchStage['student.status'] = String(status).toLowerCase();

      students = await StudentAcademicRecord.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'students',
            localField: 'studentId',
            foreignField: '_id',
            as: 'student'
          }
        },
        { $unwind: '$student' },
        { $match: studentMatchStage },
        {
          $lookup: {
            from: 'users',
            localField: 'student.userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'departments',
            localField: 'student.departmentId',
            foreignField: '_id',
            as: 'department'
          }
        },
        { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'batches',
            localField: 'student.batchId',
            foreignField: '_id',
            as: 'batch'
          }
        },
        { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'sections',
            localField: 'student.sectionId',
            foreignField: '_id',
            as: 'section'
          }
        },
        { $unwind: { path: '$section', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'academicyears',
            localField: 'academicYearId',
            foreignField: '_id',
            as: 'academicYear'
          }
        },
        {
          $unwind: { path: '$academicYear', preserveNullAndEmptyArrays: true }
        },
        {
          $project: {
            _id: '$student._id',
            firstName: '$student.firstName',
            lastName: '$student.lastName',
            registerNumber: '$student.registerNumber',
            status: '$student.status',
            rollNumber: '$student.rollNumber',
            semesterNumber: '$semesterNumber',
            yearLevel: { $ceil: { $divide: ['$semesterNumber', 2] } },
            academicYear: {
              _id: '$academicYear._id',
              name: '$academicYear.name'
            },
            department: {
              _id: '$department._id',
              name: '$department.name',
              code: '$department.code'
            },
            batch: {
              _id: '$batch._id',
              name: '$batch.name',
              startYear: '$batch.startYear',
              endYear: '$batch.endYear'
            },
            section: { _id: '$section._id', name: '$section.name' },
            user: {
              _id: '$user._id',
              email: '$user.email',
              gender: '$user.gender',
              dateOfBirth: '$user.dateOfBirth'
            },
            isActive: '$user.isActive'
          }
        }
      ]);
    } else {
      const filter = {};
      if (departmentId)
        filter.departmentId = StudentHelper.toObjectId(
          departmentId,
          'departmentId'
        );
      if (batchId)
        filter.batchId = StudentHelper.toObjectId(batchId, 'batchId');
      if (sectionId)
        filter.sectionId = StudentHelper.toObjectId(sectionId, 'sectionId');
      if (status) filter.status = String(status).toLowerCase();
      if (semesterNumber) filter.semesterNumber = Number(semesterNumber);

      students = await Student.find(filter)
        .populate('userId', 'email gender dateOfBirth isActive')
        .populate('departmentId', 'name code program')
        .populate('batchId', 'name startYear endYear')
        .populate('sectionId', 'name capacity isActive');
    }

    return res.json({
      success: true,
      message: 'Students fetched successfully',
      data: { students }
    });
  } catch (error) {
    return next(StudentHelper.mapToAppError(error));
  }
};

export const getStudentStats = async (req, res, next) => {
  try {
    const { academicYearId, departmentId, status } = req.query;
    const recordStatus = status ? String(status).toLowerCase() : 'active';

    let statsData;

    if (academicYearId) {
      const pipeline = [
        {
          $match: {
            academicYearId: StudentHelper.toObjectId(
              academicYearId,
              'academicYearId'
            ),
            status: recordStatus
          }
        }
      ];

      if (departmentId) {
        pipeline.push(
          {
            $lookup: {
              from: 'students',
              localField: 'studentId',
              foreignField: '_id',
              as: 'student'
            }
          },
          { $unwind: '$student' },
          {
            $match: {
              'student.departmentId': StudentHelper.toObjectId(
                departmentId,
                'departmentId'
              )
            }
          }
        );
      }

      pipeline.push({
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          firstYear: {
            $sum: { $cond: [{ $lte: ['$semesterNumber', 2] }, 1, 0] }
          },
          secondYear: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$semesterNumber', 3] },
                    { $lte: ['$semesterNumber', 4] }
                  ]
                },
                1,
                0
              ]
            }
          },
          thirdYear: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$semesterNumber', 5] },
                    { $lte: ['$semesterNumber', 6] }
                  ]
                },
                1,
                0
              ]
            }
          },
          fourthYear: {
            $sum: { $cond: [{ $gte: ['$semesterNumber', 7] }, 1, 0] }
          }
        }
      });

      [statsData] = await StudentAcademicRecord.aggregate(pipeline);
    } else {
      const matchStage = departmentId
        ? {
            departmentId: StudentHelper.toObjectId(departmentId, 'departmentId')
          }
        : {};

      [statsData] = await Student.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            firstYear: {
              $sum: { $cond: [{ $lte: ['$semesterNumber', 2] }, 1, 0] }
            },
            secondYear: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$semesterNumber', 3] },
                      { $lte: ['$semesterNumber', 4] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            thirdYear: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$semesterNumber', 5] },
                      { $lte: ['$semesterNumber', 6] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            fourthYear: {
              $sum: { $cond: [{ $gte: ['$semesterNumber', 7] }, 1, 0] }
            }
          }
        }
      ]);
    }

    const data = statsData || {
      totalStudents: 0,
      firstYear: 0,
      secondYear: 0,
      thirdYear: 0,
      fourthYear: 0
    };

    const { _id, totalStudents, ...yearWise } = data;

    return res.json({
      success: true,
      message: 'Student stats fetched successfully',
      data: { totalStudents: totalStudents || 0, yearWise }
    });
  } catch (error) {
    return next(StudentHelper.mapToAppError(error));
  }
};

export const getStudentDepartmentWise = async (req, res, next) => {
  try {
    const { academicYearId, departmentId, status } = req.query;
    const recordStatus = status ? String(status).toLowerCase() : 'active';

    let stats;

    if (academicYearId) {
      const pipeline = [
        {
          $match: {
            academicYearId: StudentHelper.toObjectId(
              academicYearId,
              'academicYearId'
            ),
            status: recordStatus
          }
        },
        {
          $lookup: {
            from: 'students',
            localField: 'studentId',
            foreignField: '_id',
            as: 'student'
          }
        },
        { $unwind: '$student' }
      ];

      if (departmentId) {
        pipeline.push({
          $match: {
            'student.departmentId': StudentHelper.toObjectId(
              departmentId,
              'departmentId'
            )
          }
        });
      }

      pipeline.push(
        {
          $group: {
            _id: '$student.departmentId',
            totalStudents: { $sum: 1 },
            firstYear: {
              $sum: { $cond: [{ $lte: ['$semesterNumber', 2] }, 1, 0] }
            },
            secondYear: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$semesterNumber', 3] },
                      { $lte: ['$semesterNumber', 4] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            thirdYear: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$semesterNumber', 5] },
                      { $lte: ['$semesterNumber', 6] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            fourthYear: {
              $sum: { $cond: [{ $gte: ['$semesterNumber', 7] }, 1, 0] }
            }
          }
        },
        {
          $lookup: {
            from: 'departments',
            localField: '_id',
            foreignField: '_id',
            as: 'departmentData'
          }
        },
        { $unwind: '$departmentData' },
        {
          $project: {
            _id: 0,
            departmentId: '$_id',
            departmentName: '$departmentData.name',
            totalStudents: 1,
            yearWise: {
              firstYear: '$firstYear',
              secondYear: '$secondYear',
              thirdYear: '$thirdYear',
              fourthYear: '$fourthYear'
            }
          }
        }
      );

      stats = await StudentAcademicRecord.aggregate(pipeline);
    } else {
      const pipeline = [];

      if (departmentId) {
        pipeline.push({
          $match: {
            departmentId: StudentHelper.toObjectId(departmentId, 'departmentId')
          }
        });
      }

      pipeline.push(
        {
          $group: {
            _id: '$departmentId',
            totalStudents: { $sum: 1 },
            firstYear: {
              $sum: { $cond: [{ $lte: ['$semesterNumber', 2] }, 1, 0] }
            },
            secondYear: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$semesterNumber', 3] },
                      { $lte: ['$semesterNumber', 4] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            thirdYear: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$semesterNumber', 5] },
                      { $lte: ['$semesterNumber', 6] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            fourthYear: {
              $sum: { $cond: [{ $gte: ['$semesterNumber', 7] }, 1, 0] }
            }
          }
        },
        {
          $lookup: {
            from: 'departments',
            localField: '_id',
            foreignField: '_id',
            as: 'departmentData'
          }
        },
        { $unwind: '$departmentData' },
        {
          $project: {
            _id: 0,
            departmentId: '$_id',
            departmentName: '$departmentData.name',
            totalStudents: 1,
            yearWise: {
              firstYear: '$firstYear',
              secondYear: '$secondYear',
              thirdYear: '$thirdYear',
              fourthYear: '$fourthYear'
            }
          }
        }
      );

      stats = await Student.aggregate(pipeline);
    }

    return res.json({
      success: true,
      message: 'Department stats fetched successfully',
      data: { totalDepartments: stats.length, departments: stats }
    });
  } catch (error) {
    return next(StudentHelper.mapToAppError(error));
  }
};

export const semesterShift = async (req, res, next) => {
  let session;

  try {
    const { departmentId, batchId } = req.body;

    if (!departmentId || !batchId) {
      throw new AppError('departmentId and batchId are required', 400);
    }

    const currentAcademicYear = await StudentHelper.getActiveAcademicYear();

    const students = await Student.find(
      {
        departmentId,
        batchId,
        status: 'active'
      },
      '_id semesterNumber sectionId'
    );

    if (!students.length) {
      throw new AppError(
        'No active students found for this department and batch',
        400
      );
    }

    const currentSemester = students[0].semesterNumber;
    const nextSemester = currentSemester + 1;

    const evenToOddTransition = currentSemester % 2 === 0;

    let targetAcademicYear = currentAcademicYear;
    let academicYearChanged = false;

    if (evenToOddTransition) {
      const nextStartYear = currentAcademicYear.startYear + 1;

      targetAcademicYear = await AcademicYear.findOne({
        startYear: nextStartYear
      });

      if (!targetAcademicYear) {
        const newEnd = currentAcademicYear.endYear + 1;
        const name = `${nextStartYear}-${String(newEnd).slice(-2)}`;

        targetAcademicYear = await AcademicYear.create({
          name,
          startYear: nextStartYear,
          endYear: newEnd,
          isActive: true
        });
      }

      await AcademicYear.updateOne(
        { _id: currentAcademicYear._id },
        { isActive: false }
      );

      await AcademicYear.updateOne(
        { _id: targetAcademicYear._id },
        { isActive: true }
      );

      academicYearChanged = true;
    }

    // Safety check
    const existingRecord = await StudentAcademicRecord.findOne({
      academicYearId: targetAcademicYear._id,
      semesterNumber: nextSemester
    }).select('_id');

    if (existingRecord) {
      throw new AppError('Semester shift already executed for this batch', 400);
    }

    session = await mongoose.startSession();
    session.startTransaction();

    // 🔹 Step 1: Mark previous semester records as completed
    await StudentAcademicRecord.updateMany(
      {
        academicYearId: currentAcademicYear._id,
        semesterNumber: currentSemester,
        status: 'active'
      },
      {
        $set: { status: 'completed' }
      },
      { session }
    );

    const studentUpdates = [];
    const academicRecords = [];

    let promoted = 0;
    let graduated = 0;

    for (const student of students) {
      const nextSem = student.semesterNumber + 1;

      if (nextSem > 8) {
        studentUpdates.push({
          updateOne: {
            filter: { _id: student._id },
            update: { $set: { status: 'graduated' } }
          }
        });

        graduated++;
      } else {
        studentUpdates.push({
          updateOne: {
            filter: { _id: student._id },
            update: { $set: { semesterNumber: nextSem } }
          }
        });

        academicRecords.push({
          insertOne: {
            document: {
              studentId: student._id,
              academicYearId: targetAcademicYear._id,
              semesterNumber: nextSem,
              sectionId: student.sectionId,
              status: 'active'
            }
          }
        });

        promoted++;
      }
    }

    if (studentUpdates.length) {
      await Student.bulkWrite(studentUpdates, { session });
    }

    if (academicRecords.length) {
      await StudentAcademicRecord.bulkWrite(academicRecords, { session });
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Semester shift completed successfully',
      data: {
        departmentId,
        batchId,
        totalStudents: students.length,
        studentsPromoted: promoted,
        studentsGraduated: graduated,
        academicYearChanged,
        academicYear: targetAcademicYear.name
      }
    });
  } catch (error) {
    if (session) await session.abortTransaction();
    return next(StudentHelper.mapToAppError(error));
  } finally {
    if (session) session.endSession();
  }
};

export const getSemesterShiftInfo = async (req, res, next) => {
  try {
    const { departmentId, batchId } = req.query;

    if (!departmentId || !batchId) {
      throw new AppError('departmentId and batchId are required', 400);
    }

    const students = await Student.find(
      {
        departmentId,
        batchId,
        status: 'active'
      },
      'semesterNumber'
    );

    if (!students.length) {
      return res.json({
        success: true,
        data: {
          currentSemester: null,
          nextSemester: null,
          academicYearChange: false,
          studentCount: 0
        }
      });
    }

    const uniqueSemesters = new Set(students.map((s) => s.semesterNumber));

    if (uniqueSemesters.size !== 1) {
      throw new AppError(
        'Data inconsistency detected: students have different semesters',
        500
      );
    }

    const currentSemester = students[0].semesterNumber;
    const nextSemester = currentSemester + 1;

    const academicYearChange = currentSemester % 2 === 0;

    res.json({
      success: true,
      data: {
        currentSemester,
        nextSemester,
        academicYearChange,
        studentCount: students.length
      }
    });
  } catch (error) {
    return next(StudentHelper.mapToAppError(error));
  }
};
