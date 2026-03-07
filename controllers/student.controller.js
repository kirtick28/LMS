import mongoose from 'mongoose';
import xlsx from 'xlsx';
import Student from '../models/Student.js';
import User from '../models/User.js';
import StudentAcademicRecord from '../models/StudentAcademicRecord.js';
import AppError from '../utils/AppError.js';
import StudentHelper from '../utils/StudentHelper.js';

export const addStudent = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

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

    // Check unique constraints
    const existingUser = await User.findOne({ email: normalizedEmail }).session(
      session
    );
    if (existingUser)
      throw new AppError('User already exists with this email', 400);

    const existingStudent = await Student.findOne({
      registerNumber: normalizedRegister
    }).session(session);
    if (existingStudent)
      throw new AppError(
        'Student with this registerNumber already exists',
        400
      );

    // Resolve Relationships & Context using Helper
    const { section } = await StudentHelper.resolveContext(
      departmentId,
      batchId,
      sectionId
    );
    const activeAcademicYear = await StudentHelper.getActiveAcademicYear();

    const finalSemesterNumber = Number(semesterNumber) || 1;

    // 1. Create User
    const [user] = await User.create(
      [
        {
          email: normalizedEmail,
          password,
          role: 'STUDENT',
          gender,
          dateOfBirth
        }
      ],
      { session }
    );

    // 2. Create Student
    const [student] = await Student.create(
      [
        {
          userId: user._id,
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

    // 3. Create Academic Record (Ensuring unique combo)
    const existingRecord = await StudentAcademicRecord.findOne({
      studentId: student._id,
      academicYearId: activeAcademicYear._id,
      semesterNumber: finalSemesterNumber
    }).session(session);

    if (!existingRecord) {
      await StudentAcademicRecord.create(
        [
          {
            studentId: student._id,
            academicYearId: activeAcademicYear._id,
            semesterNumber: finalSemesterNumber,
            sectionId: section._id,
            status: 'active'
          }
        ],
        { session }
      );
    }

    await session.commitTransaction();
    return res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: { student }
    });
  } catch (error) {
    await session.abortTransaction();
    return next(StudentHelper.mapToAppError(error));
  } finally {
    session.endSession();
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

    // Identify if Section or Semester is changing
    const isSectionChanged =
      updateData.sectionId &&
      String(updateData.sectionId) !== String(student.sectionId);
    const isSemesterChanged =
      updateData.semesterNumber &&
      Number(updateData.semesterNumber) !== student.semesterNumber;

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
      'semesterNumber',
      'entryType',
      'status'
    ];
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) student[field] = updateData[field];
    });

    await student.save({ session });

    // Handle Section / Semester Change Logic for Academic Records
    if (isSectionChanged || isSemesterChanged) {
      const activeAcademicYear = await StudentHelper.getActiveAcademicYear();
      const targetSemester = student.semesterNumber; // current updated semester

      const academicRecord = await StudentAcademicRecord.findOne({
        studentId: student._id,
        academicYearId: activeAcademicYear._id,
        semesterNumber: targetSemester
      }).session(session);

      if (isSemesterChanged && !academicRecord) {
        // Create new record for new semester
        await StudentAcademicRecord.create(
          [
            {
              studentId: student._id,
              academicYearId: activeAcademicYear._id,
              semesterNumber: targetSemester,
              sectionId: student.sectionId,
              status: 'active'
            }
          ],
          { session }
        );
      } else if (isSectionChanged && academicRecord) {
        // Update section on current semester's record
        academicRecord.sectionId = student.sectionId;
        await academicRecord.save({ session });
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw new AppError('Invalid student ID', 400);

    const student = await Student.findById(id).session(session);
    if (!student) throw new AppError('Student not found', 404);

    await User.findByIdAndDelete(student.userId).session(session);
    await StudentAcademicRecord.deleteMany({ studentId: id }).session(session);
    await Student.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    return res.json({
      success: true,
      message: 'Student deleted successfully',
      data: {}
    });
  } catch (error) {
    await session.abortTransaction();
    return next(StudentHelper.mapToAppError(error));
  } finally {
    session.endSession();
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
      status,
      admissionYear
    } = req.query;

    let students;

    if (academicYearId) {
      // --- STRATEGY: Start from StudentAcademicRecord ---
      const matchStage = {
        academicYearId: StudentHelper.toObjectId(
          academicYearId,
          'academicYearId'
        )
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
      if (admissionYear)
        studentMatchStage['student.admissionYear'] = Number(admissionYear);

      students = await StudentAcademicRecord.aggregate([
        { $match: matchStage }, // Rule 1: Match early
        {
          $lookup: {
            from: 'students',
            localField: 'studentId',
            foreignField: '_id',
            as: 'student'
          }
        },
        { $unwind: '$student' },
        { $match: studentMatchStage }, // Filter by student properties
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
            // Rule 3: Avoid loading large documents completely
            _id: '$student._id',
            firstName: '$student.firstName',
            lastName: '$student.lastName',
            registerNumber: '$student.registerNumber',
            status: '$student.status',
            admissionYear: '$student.admissionYear',
            semesterNumber: '$semesterNumber', // Rule 4: Reuse from AcademicRecord
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
              gender: '$user.gender'
            }
          }
        }
      ]);
    } else {
      // --- STRATEGY: Start directly from Student Collection ---
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
      if (admissionYear) filter.admissionYear = Number(admissionYear);
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

export const updateStudentSemester = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { semesterNumber } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      throw new AppError('Invalid student ID', 400);
    const normalizedSemesterNumber = Number(semesterNumber);
    if (!normalizedSemesterNumber || normalizedSemesterNumber < 1)
      throw new AppError('Invalid semester number', 400);

    const student = await Student.findById(id).session(session);
    if (!student) throw new AppError('Student not found', 404);

    const activeAcademicYear = await StudentHelper.getActiveAcademicYear();

    student.semesterNumber = normalizedSemesterNumber;
    await student.save({ session });

    const existingRecord = await StudentAcademicRecord.findOne({
      studentId: student._id,
      academicYearId: activeAcademicYear._id,
      semesterNumber: normalizedSemesterNumber
    }).session(session);

    if (!existingRecord) {
      await StudentAcademicRecord.create(
        [
          {
            studentId: student._id,
            academicYearId: activeAcademicYear._id,
            semesterNumber: normalizedSemesterNumber,
            sectionId: student.sectionId,
            status: 'active'
          }
        ],
        { session }
      );
    }

    await session.commitTransaction();
    return res.json({
      success: true,
      message: 'Student semester promoted successfully',
      data: { student }
    });
  } catch (error) {
    await session.abortTransaction();
    return next(StudentHelper.mapToAppError(error));
  } finally {
    session.endSession();
  }
};

export const uploadMultipleStudents = async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);

    const workbook = req.file.buffer
      ? xlsx.read(req.file.buffer, { type: 'buffer' })
      : xlsx.readFile(req.file.path);
    const sheet = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

    let inserted = 0,
      skipped = 0,
      failed = 0;
    const activeAcademicYear = await StudentHelper.getActiveAcademicYear();

    for (const row of rows) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const {
          email,
          password,
          firstName,
          lastName,
          registerNumber,
          semesterNumber,
          departmentId,
          batchId,
          sectionId
        } = row;

        if (
          !email ||
          !firstName ||
          !lastName ||
          !registerNumber ||
          !departmentId ||
          !batchId
        ) {
          failed++;
          await session.abortTransaction();
          session.endSession();
          continue;
        }

        const normalizedEmail = String(email).toLowerCase().trim();
        const normalizedRegister = String(registerNumber).toUpperCase().trim();

        const duplicateExists =
          (await User.findOne({ email: normalizedEmail }).session(session)) ||
          (await Student.findOne({
            registerNumber: normalizedRegister
          }).session(session));

        if (duplicateExists) {
          skipped++;
          await session.abortTransaction();
          session.endSession();
          continue;
        }

        const { section } = await StudentHelper.resolveContext(
          departmentId,
          batchId,
          sectionId
        );
        const finalSem = Number(semesterNumber) || 1;

        const [user] = await User.create(
          [
            {
              email: normalizedEmail,
              password: password || '123456',
              role: 'STUDENT'
            }
          ],
          { session }
        );

        const [student] = await Student.create(
          [
            {
              userId: user._id,
              departmentId,
              batchId,
              sectionId: section._id,
              firstName,
              lastName,
              registerNumber: normalizedRegister,
              semesterNumber: finalSem
            }
          ],
          { session }
        );

        await StudentAcademicRecord.create(
          [
            {
              studentId: student._id,
              academicYearId: activeAcademicYear._id,
              semesterNumber: finalSem,
              sectionId: section._id,
              status: 'active'
            }
          ],
          { session }
        );

        await session.commitTransaction();
        inserted++;
      } catch (error) {
        await session.abortTransaction();
        failed++;
      } finally {
        session.endSession();
      }
    }

    return res.json({
      success: true,
      message: 'Upload completed',
      data: { inserted, skipped, failed }
    });
  } catch (error) {
    return next(StudentHelper.mapToAppError(error));
  }
};

export const getStudentStats = async (req, res, next) => {
  try {
    const { academicYearId, departmentId } = req.query;
    let statsData;

    if (academicYearId) {
      // --- STRATEGY: Start from StudentAcademicRecord ---
      const pipeline = [
        {
          $match: {
            academicYearId: StudentHelper.toObjectId(
              academicYearId,
              'academicYearId'
            )
          }
        }
      ];

      // If department filter exists, we MUST lookup student first to filter
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
      // --- STRATEGY: Start directly from Student Collection ---
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
    const { academicYearId } = req.query;
    let stats;

    if (academicYearId) {
      // --- STRATEGY: Start from StudentAcademicRecord ---
      stats = await StudentAcademicRecord.aggregate([
        {
          $match: {
            academicYearId: StudentHelper.toObjectId(
              academicYearId,
              'academicYearId'
            )
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
        { $unwind: '$student' },
        {
          $group: {
            _id: '$student.departmentId', // Group by the matched student's department
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
      ]);
    } else {
      // --- STRATEGY: Start directly from Student Collection ---
      stats = await Student.aggregate([
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
      ]);
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch active academic year
    const currentAcademicYear = await StudentHelper.getActiveAcademicYear();

    // 2. Fetch all active students
    const activeStudents = await Student.find({
      status: 'active',
      isActive: true
    }).session(session);

    if (activeStudents.length === 0) {
      throw new AppError('No active students found to promote', 400);
    }

    // 3. Determine if Academic Year shift is needed (EVEN -> ODD Transition)
    // If we detect students currently in Even semesters, it implies an Even -> Odd transition.
    const isEvenSemesterPhase = activeStudents.some(
      (s) => s.semesterNumber % 2 === 0
    );

    let targetAcademicYear = currentAcademicYear;
    let academicYearChanged = false;

    if (isEvenSemesterPhase) {
      // Transitioning to a new Academic Year
      targetAcademicYear = await AcademicYear.findOne({
        startYear: currentAcademicYear.startYear + 1
      }).session(session);

      if (!targetAcademicYear) {
        // Auto-create next academic year if missing
        const newStart = currentAcademicYear.startYear + 1;
        const newEnd = currentAcademicYear.endYear + 1;
        const newName = `${newStart}-${String(newEnd).slice(-2)}`;

        const [createdYear] = await AcademicYear.create(
          [
            {
              name: newName,
              startYear: newStart,
              endYear: newEnd,
              isActive: true
            }
          ],
          { session }
        );

        targetAcademicYear = createdYear;
      } else {
        targetAcademicYear.isActive = true;
        await targetAcademicYear.save({ session });
      }

      // Deactivate old academic year
      currentAcademicYear.isActive = false;
      await currentAcademicYear.save({ session });
      academicYearChanged = true;
    }

    // 4. Safety Validation - Prevent running twice accidentally
    const nextSemesters = activeStudents.map((s) => s.semesterNumber + 1);
    const existingRecordsCount = await StudentAcademicRecord.countDocuments({
      academicYearId: targetAcademicYear._id,
      semesterNumber: { $in: nextSemesters }
    }).session(session);

    if (existingRecordsCount > activeStudents.length * 0.5) {
      throw new AppError(
        'Shift safety triggered: Records for the upcoming semester already exist.',
        400
      );
    }

    // 5. Prepare Bulk Operations
    const studentUpdates = [];
    const academicRecordInserts = [];
    let studentsPromoted = 0;
    let studentsGraduated = 0;

    for (const student of activeStudents) {
      const nextSemester = student.semesterNumber + 1;

      if (nextSemester > 8) {
        // Graduate student
        studentUpdates.push({
          updateOne: {
            filter: { _id: student._id },
            update: { $set: { status: 'graduated', isActive: false } }
          }
        });
        studentsGraduated++;
      } else {
        // Promote student
        studentUpdates.push({
          updateOne: {
            filter: { _id: student._id },
            update: { $set: { semesterNumber: nextSemester } }
          }
        });

        // Add history record
        academicRecordInserts.push({
          insertOne: {
            document: {
              studentId: student._id,
              academicYearId: targetAcademicYear._id,
              semesterNumber: nextSemester,
              sectionId: student.sectionId,
              status: 'active'
            }
          }
        });
        studentsPromoted++;
      }
    }

    // 6. Execute Bulk Writes natively in MongoDB for high performance
    if (studentUpdates.length > 0) {
      await Student.bulkWrite(studentUpdates, { session });
    }

    if (academicRecordInserts.length > 0) {
      await StudentAcademicRecord.bulkWrite(academicRecordInserts, { session });
    }

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Global semester shift completed successfully',
      data: {
        totalStudentsProcessed: activeStudents.length,
        studentsPromoted,
        studentsGraduated,
        academicYearChanged,
        newAcademicYearName: targetAcademicYear.name
      }
    });
  } catch (error) {
    await session.abortTransaction();
    return next(StudentHelper.mapToAppError(error));
  } finally {
    session.endSession();
  }
};
