import mongoose from 'mongoose';
import xlsx from 'xlsx';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import AppError from '../utils/AppError.js';
import FacultyHelper from '../utils/FacultyHelper.js';

/**
 * Helper class containing all reusable utility functions
 */
// class FacultyHelper {
//   /**
//    * Normalize a key by removing spaces, underscores, hyphens and lowercasing
//    */
//   static normalizeKey(key) {
//     return key
//       .toString()
//       .trim()
//       .toLowerCase()
//       .replace(/\s+/g, '')
//       .replace(/[_-]/g, '');
//   }

//   /**
//    * Get first non‑empty variant from normalized object
//    */
//   static getNorm(normalized, ...variants) {
//     for (const variant of variants) {
//       if (
//         normalized[variant] !== undefined &&
//         normalized[variant] !== null &&
//         normalized[variant] !== ''
//       ) {
//         return normalized[variant];
//       }
//     }
//     return undefined;
//   }

//   /**
//    * Clean a string: remove quotes, trim
//    */
//   static clean(value) {
//     return String(value || '')
//       .replace(/['"]+/g, '')
//       .trim();
//   }

//   /**
//    * Normalize a department code: uppercase, remove non‑alphanumeric, limit to 10 chars
//    */
//   static normalizeCode(value) {
//     if (!value) return '';
//     return String(value)
//       .toUpperCase()
//       .replace(/[^A-Z0-9]/g, '')
//       .slice(0, 10);
//   }

//   /**
//    * Normalize a phone number: extract digits, ensure 10 digits, else null
//    */
//   static normalizePhone(value) {
//     if (!value) return null;
//     const digits = String(value).replace(/\D/g, '');
//     if (/^[0-9]{10}$/.test(digits)) return digits;
//     return null;
//   }

//   /**
//    * Normalize a designation string to one of the enum values
//    */
//   static normalizeDesignation(rawDesignation) {
//     const cleaned = FacultyHelper.clean(rawDesignation) || 'Faculty';
//     const key = cleaned.toLowerCase().replace(/\s+/g, ' ').trim();

//     const map = {
//       professor: 'Professor',
//       'assistant professor': 'Assistant Professor',
//       'associate professor': 'Associate Professor',
//       hod: 'HOD',
//       dean: 'Dean',
//       faculty: 'Faculty',
//       'professor of practice': 'Professor of Practice',
//       'lab technician': 'Lab Technician',
//       'department secretary': 'Department Secretary',
//       'senior lab technician': 'Senior Lab Technician'
//     };

//     return map[key] || 'Faculty';
//   }

//   /**
//    * Normalize workType to one of the enum values
//    */
//   static normalizeWorkType(rawWorkType) {
//     if (!rawWorkType) return undefined;
//     const cleaned = FacultyHelper.clean(rawWorkType);
//     const lower = cleaned.toLowerCase();
//     const map = {
//       'full time': 'Full Time',
//       fulltime: 'Full Time',
//       'full-time': 'Full Time',
//       'part time': 'Part Time',
//       parttime: 'Part Time',
//       'part-time': 'Part Time',
//       contract: 'Contract',
//       visiting: 'Visiting'
//     };
//     return map[lower] || undefined;
//   }

//   /**
//    * Parse a date from various formats (Excel serial, string, Date object)
//    */
//   static parseDateValue(value) {
//     if (!value) return null;
//     if (value instanceof Date) return value;

//     if (typeof value === 'number') {
//       const serialDate = xlsx.SSF.parse_date_code(value);
//       if (!serialDate) return null;
//       return new Date(serialDate.y, serialDate.m - 1, serialDate.d);
//     }

//     const parsed = new Date(value);
//     return Number.isNaN(parsed.getTime()) ? null : parsed;
//   }

//   /**
//    * Validate that a given ID is a valid ObjectId and that a department exists with that ID
//    */
//   static async validateDepartmentId(id, session = null) {
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       throw new Error('Invalid department ID format');
//     }
//     const query = Department.findById(id);
//     if (session) query.session(session);
//     const department = await query;
//     if (!department) {
//       throw new Error('Department not found');
//     }
//     return department;
//   }

//   /**
//    * Normalize an entire Excel row into a consistent payload object
//    */
//   static normalizeExcelRow(row) {
//     const normalized = {};

//     for (const [key, value] of Object.entries(row || {})) {
//       normalized[FacultyHelper.normalizeKey(key)] = value;
//     }

//     return {
//       email: FacultyHelper.clean(
//         FacultyHelper.getNorm(
//           normalized,
//           'email',
//           'emailaddress',
//           'mail',
//           'mailid'
//         )
//       ).toLowerCase(),
//       password: FacultyHelper.clean(
//         FacultyHelper.getNorm(normalized, 'password', 'pass')
//       ),
//       firstName: FacultyHelper.clean(
//         FacultyHelper.getNorm(normalized, 'firstname', 'fname', 'name')
//       ),
//       lastName: FacultyHelper.clean(
//         FacultyHelper.getNorm(normalized, 'lastname', 'lname', 'surname')
//       ),
//       primaryPhone: FacultyHelper.clean(
//         FacultyHelper.getNorm(
//           normalized,
//           'primaryphone',
//           'mobilenumber',
//           'mobile',
//           'phone',
//           'phone1'
//         )
//       ),
//       secondaryPhone: FacultyHelper.clean(
//         FacultyHelper.getNorm(
//           normalized,
//           'secondaryphone',
//           'alternatenumber',
//           'altphone',
//           'phone2',
//           'mobile2'
//         )
//       ),
//       employeeId: FacultyHelper.clean(
//         FacultyHelper.getNorm(normalized, 'employeeid', 'empid', 'employeecode')
//       ).toUpperCase(),
//       designation: FacultyHelper.getNorm(normalized, 'designation', 'role'),
//       // For bulk upload we now expect departmentCode (not departmentId)
//       departmentCode: FacultyHelper.clean(
//         FacultyHelper.getNorm(
//           normalized,
//           'departmentcode',
//           'deptcode',
//           'code',
//           'department'
//         )
//       ),
//       qualification: FacultyHelper.clean(
//         FacultyHelper.getNorm(normalized, 'qualification')
//       ),
//       workType: FacultyHelper.clean(
//         FacultyHelper.getNorm(normalized, 'worktype', 'employmenttype')
//       ),
//       joiningDate: FacultyHelper.getNorm(normalized, 'joiningdate', 'doj'),
//       reportingManager: FacultyHelper.clean(
//         FacultyHelper.getNorm(normalized, 'reportingmanager', 'managerid')
//       ),
//       noticePeriod: FacultyHelper.clean(
//         FacultyHelper.getNorm(normalized, 'noticeperiod')
//       ),
//       salutation: FacultyHelper.clean(
//         FacultyHelper.getNorm(normalized, 'salutation')
//       ),
//       gender: FacultyHelper.clean(FacultyHelper.getNorm(normalized, 'gender')),
//       dateOfBirth: FacultyHelper.getNorm(normalized, 'dateofbirth', 'dob')
//     };
//   }
// }

export const addFaculty = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      salutation,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      email,
      primaryPhone,
      secondaryPhone,
      qualification,
      workType,
      employeeId,
      joiningDate,
      designation,
      reportingManager,
      noticePeriod,
      password,
      departmentId // directly from body
    } = req.body;

    // Required fields validation
    const requiredFields = [
      'salutation',
      'firstName',
      'lastName',
      'gender',
      'dateOfBirth',
      'email',
      'primaryPhone',
      'qualification',
      'workType',
      'employeeId',
      'joiningDate',
      'designation',
      'departmentId'
    ];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `${field} is required`,
          data: {}
        });
      }
    }

    const cleanEmail = FacultyHelper.clean(email).toLowerCase();
    const cleanEmployeeId = FacultyHelper.clean(employeeId).toUpperCase();

    // Check for existing user / faculty within session
    const [existingUser, existingEmployee] = await Promise.all([
      User.findOne({ email: cleanEmail }).session(session),
      Faculty.findOne({ employeeId: cleanEmployeeId }).session(session)
    ]);

    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
        data: {}
      });
    }
    if (existingEmployee) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Faculty already exists with this employeeId',
        data: {}
      });
    }

    // Validate department
    const department = await FacultyHelper.validateDepartmentId(
      departmentId,
      session
    );

    // Parse dates
    const parsedDOB = FacultyHelper.parseDateValue(dateOfBirth);
    const parsedJoining = FacultyHelper.parseDateValue(joiningDate);
    if (!parsedDOB || !parsedJoining) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid date format for dateOfBirth or joiningDate',
        data: {}
      });
    }

    // Normalize phone numbers
    const normPrimaryPhone = FacultyHelper.normalizePhone(primaryPhone);
    if (!normPrimaryPhone) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'primaryPhone must be a valid 10-digit number',
        data: {}
      });
    }
    const normSecondaryPhone =
      FacultyHelper.normalizePhone(secondaryPhone) || null;

    // Normalize designation
    const normDesignation = FacultyHelper.normalizeDesignation(designation);

    // Validate workType against enum
    const validWorkTypes = ['Full Time', 'Contract', 'Part Time', 'Visiting'];
    const normWorkType = FacultyHelper.normalizeWorkType(workType);
    if (!normWorkType || !validWorkTypes.includes(normWorkType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `workType must be one of: ${validWorkTypes.join(', ')}`,
        data: {}
      });
    }

    // Create user
    const [user] = await User.create(
      [
        {
          email: cleanEmail,
          password: password || 'sece@123',
          role: 'FACULTY',
          gender,
          dateOfBirth: parsedDOB
        }
      ],
      { session }
    );

    // Create faculty
    const [faculty] = await Faculty.create(
      [
        {
          userId: user._id,
          departmentId: department._id,
          salutation: FacultyHelper.clean(salutation),
          firstName: FacultyHelper.clean(firstName),
          lastName: FacultyHelper.clean(lastName),
          primaryPhone: normPrimaryPhone,
          secondaryPhone: normSecondaryPhone,
          employeeId: cleanEmployeeId,
          designation: normDesignation,
          qualification: FacultyHelper.clean(qualification),
          workType: normWorkType,
          joiningDate: parsedJoining,
          reportingManager: reportingManager || null,
          noticePeriod: FacultyHelper.clean(noticePeriod) || undefined
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: 'Faculty and User created successfully',
      data: { faculty }
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    return next(error);
  }
};

export const updateFaculty = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid faculty id',
        data: {}
      });
    }

    const faculty = await Faculty.findById(id);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found',
        data: {}
      });
    }

    const user = await User.findById(faculty.userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Linked user not found',
        data: {}
      });
    }

    // Handle email update
    if (req.body.email !== undefined) {
      const updatedEmail = FacultyHelper.clean(req.body.email).toLowerCase();
      const duplicateEmail = await User.findOne({
        email: updatedEmail,
        _id: { $ne: user._id }
      });
      if (duplicateEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use',
          data: {}
        });
      }
      user.email = updatedEmail;
    }

    // Handle user fields
    if (req.body.password) user.password = req.body.password;
    if (req.body.gender !== undefined) user.gender = req.body.gender;
    if (req.body.dateOfBirth !== undefined) {
      const parsed = FacultyHelper.parseDateValue(req.body.dateOfBirth);
      if (!parsed) {
        return res.status(400).json({
          success: false,
          message: 'Invalid dateOfBirth format',
          data: {}
        });
      }
      user.dateOfBirth = parsed;
    }
    if (req.body.isActive !== undefined) {
      user.isActive = !!req.body.isActive;
    }

    // Handle faculty simple fields
    const simpleFields = [
      'salutation',
      'firstName',
      'lastName',
      'qualification',
      'noticePeriod',
      'employmentStatus'
    ];
    simpleFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        faculty[field] = FacultyHelper.clean(req.body[field]);
      }
    });

    // Handle phone numbers
    if (req.body.primaryPhone !== undefined) {
      const norm = FacultyHelper.normalizePhone(req.body.primaryPhone);
      if (!norm) {
        return res.status(400).json({
          success: false,
          message: 'primaryPhone must be a valid 10-digit number',
          data: {}
        });
      }
      faculty.primaryPhone = norm;
    }
    if (req.body.secondaryPhone !== undefined) {
      faculty.secondaryPhone =
        FacultyHelper.normalizePhone(req.body.secondaryPhone) || null;
    }

    // Handle employeeId
    if (req.body.employeeId !== undefined) {
      const nextEmployeeId = FacultyHelper.clean(
        req.body.employeeId
      ).toUpperCase();
      const duplicateEmployee = await Faculty.findOne({
        employeeId: nextEmployeeId,
        _id: { $ne: faculty._id }
      });
      if (duplicateEmployee) {
        return res.status(400).json({
          success: false,
          message: 'employeeId already in use',
          data: {}
        });
      }
      faculty.employeeId = nextEmployeeId;
    }

    // Handle designation
    if (req.body.designation !== undefined) {
      faculty.designation = FacultyHelper.normalizeDesignation(
        req.body.designation
      );
    }

    // Handle workType
    if (req.body.workType !== undefined) {
      const validWorkTypes = ['Full Time', 'Contract', 'Part Time', 'Visiting'];
      const normWorkType = FacultyHelper.normalizeWorkType(req.body.workType);
      if (!normWorkType || !validWorkTypes.includes(normWorkType)) {
        return res.status(400).json({
          success: false,
          message: `workType must be one of: ${validWorkTypes.join(', ')}`,
          data: {}
        });
      }
      faculty.workType = normWorkType;
    }

    // Handle joiningDate
    if (req.body.joiningDate !== undefined) {
      const parsed = FacultyHelper.parseDateValue(req.body.joiningDate);
      if (!parsed) {
        return res.status(400).json({
          success: false,
          message: 'Invalid joiningDate format',
          data: {}
        });
      }
      faculty.joiningDate = parsed;
    }

    // Handle reportingManager
    if (req.body.reportingManager !== undefined) {
      faculty.reportingManager = req.body.reportingManager || null;
    }

    // Handle department update
    if (req.body.departmentId !== undefined) {
      const department = await FacultyHelper.validateDepartmentId(
        req.body.departmentId
      );
      faculty.departmentId = department._id;
    }

    await Promise.all([faculty.save(), user.save()]);

    return res.json({
      success: true,
      message: 'Faculty updated successfully',
      data: { faculty }
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteFaculty = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid faculty id',
        data: {}
      });
    }

    const faculty = await Faculty.findById(id);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found',
        data: {}
      });
    }

    const user = await User.findById(faculty.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Linked user not found',
        data: {}
      });
    }

    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      message: 'Faculty deactivated successfully',
      data: {}
    });
  } catch (error) {
    return next(error);
  }
};

export const uploadMultipleFaculty = async (req, res, next) => {
  let session;
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    // Read workbook
    const workbook = req.file.buffer
      ? xlsx.read(req.file.buffer, { type: 'buffer' })
      : xlsx.readFile(req.file.path);

    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Pre‑fetch departments within the transaction
    const departments = await Department.find({}).session(session);
    const deptMap = new Map();
    departments.forEach((dept) => {
      deptMap.set(dept.code, dept._id);
    });

    let usersCreated = 0;
    let usersUpdated = 0;
    let facultyCreated = 0;
    let facultyUpdated = 0;
    const failedRows = [];

    for (let index = 0; index < rows.length; index++) {
      const rowNumber = index + 2; // Excel rows are 1‑based plus header
      try {
        const payload = FacultyHelper.normalizeExcelRow(rows[index]);

        // ----- Required field validation -----
        const requiredFields = [
          'email',
          'firstName',
          'lastName',
          'employeeId',
          'primaryPhone',
          'departmentCode',
          'salutation',
          'gender',
          'dateOfBirth',
          'joiningDate',
          'qualification',
          'designation',
          'workType'
        ];
        for (const field of requiredFields) {
          if (
            payload[field] === undefined ||
            payload[field] === null ||
            String(payload[field]).trim() === ''
          ) {
            throw new Error(`${field} is required`);
          }
        }

        // ----- Department validation -----
        const departmentCode = payload.departmentCode.toUpperCase().trim();
        const departmentId = deptMap.get(departmentCode);
        if (!departmentId) {
          throw new Error(`Department code "${departmentCode}" not found`);
        }

        // ----- Phone validation -----
        const primaryPhone = FacultyHelper.normalizePhone(payload.primaryPhone);
        if (!primaryPhone) {
          throw new Error('primaryPhone must be a valid 10-digit number');
        }
        const secondaryPhone =
          FacultyHelper.normalizePhone(payload.secondaryPhone) || null;

        // ----- Date validation -----
        const dateOfBirth = FacultyHelper.parseDateValue(payload.dateOfBirth);
        if (!dateOfBirth) {
          throw new Error('dateOfBirth must be a valid date');
        }
        const joiningDate = FacultyHelper.parseDateValue(payload.joiningDate);
        if (!joiningDate) {
          throw new Error('joiningDate must be a valid date');
        }

        // ----- Designation validation -----
        const designation = FacultyHelper.normalizeDesignation(
          payload.designation
        );
        const validDesignations = [
          'Professor',
          'Associate Professor',
          'Assistant Professor',
          'HOD',
          'Dean',
          'Faculty',
          'Professor of Practice',
          'Lab Technician',
          'Senior Lab Technician',
          'Department Secretary'
        ];
        if (!validDesignations.includes(designation)) {
          throw new Error(`designation "${payload.designation}" is not valid`);
        }

        // ----- WorkType validation -----
        const validWorkTypes = [
          'Full Time',
          'Contract',
          'Part Time',
          'Visiting'
        ];
        const workType = FacultyHelper.normalizeWorkType(payload.workType);
        if (!workType || !validWorkTypes.includes(workType)) {
          throw new Error(
            `workType must be one of: ${validWorkTypes.join(', ')}`
          );
        }

        // ----- Clean values -----
        const cleanEmail = payload.email.toLowerCase().trim();
        const cleanEmployeeId = payload.employeeId.toUpperCase().trim();
        const firstName = payload.firstName.trim();
        const lastName = payload.lastName.trim();
        const salutation = payload.salutation.trim();
        const gender = payload.gender.trim();
        const qualification = payload.qualification.trim();
        const noticePeriod = payload.noticePeriod
          ? payload.noticePeriod.trim()
          : undefined;
        const reportingManager = payload.reportingManager
          ? payload.reportingManager.trim()
          : null;

        // ----- Find or create user/faculty within transaction -----
        let user = await User.findOne({ email: cleanEmail }).session(session);
        let faculty = await Faculty.findOne({
          employeeId: cleanEmployeeId
        }).session(session);

        // Case 1: Neither user nor faculty exists → create both
        if (!user && !faculty) {
          const [newUser] = await User.create(
            [
              {
                email: cleanEmail,
                password: payload.password || 'sece@123',
                role: 'FACULTY',
                gender,
                dateOfBirth
              }
            ],
            { session }
          );
          user = newUser;
          usersCreated++;

          const [newFaculty] = await Faculty.create(
            [
              {
                userId: user._id,
                departmentId,
                salutation,
                firstName,
                lastName,
                primaryPhone,
                secondaryPhone,
                employeeId: cleanEmployeeId,
                designation,
                qualification,
                workType,
                joiningDate,
                reportingManager,
                noticePeriod
              }
            ],
            { session }
          );
          faculty = newFaculty;
          facultyCreated++;
        }
        // Case 2: Faculty exists but user doesn't (inconsistent) → create user and link
        else if (!user && faculty) {
          const [newUser] = await User.create(
            [
              {
                email: cleanEmail,
                password: payload.password || 'sece@123',
                role: 'FACULTY',
                gender,
                dateOfBirth
              }
            ],
            { session }
          );
          user = newUser;
          usersCreated++;

          faculty.userId = user._id;
          faculty.departmentId = departmentId;
          faculty.salutation = salutation;
          faculty.firstName = firstName;
          faculty.lastName = lastName;
          faculty.primaryPhone = primaryPhone;
          faculty.secondaryPhone = secondaryPhone;
          faculty.employeeId = cleanEmployeeId;
          faculty.designation = designation;
          faculty.qualification = qualification;
          faculty.workType = workType;
          faculty.joiningDate = joiningDate;
          faculty.reportingManager = reportingManager;
          faculty.noticePeriod = noticePeriod;
          await faculty.save({ session });
          facultyUpdated++;
        }
        // Case 3: User exists
        else if (user) {
          // Update user fields
          user.gender = gender;
          user.dateOfBirth = dateOfBirth;
          if (user.role !== 'FACULTY') {
            user.role = 'FACULTY';
          }
          await user.save({ session });
          usersUpdated++;

          // Find or create faculty for this user
          if (!faculty) {
            faculty = await Faculty.findOne({ userId: user._id }).session(
              session
            );
          }

          if (faculty) {
            // Update existing faculty
            faculty.departmentId = departmentId;
            faculty.salutation = salutation;
            faculty.firstName = firstName;
            faculty.lastName = lastName;
            faculty.primaryPhone = primaryPhone;
            faculty.secondaryPhone = secondaryPhone;
            faculty.employeeId = cleanEmployeeId;
            faculty.designation = designation;
            faculty.qualification = qualification;
            faculty.workType = workType;
            faculty.joiningDate = joiningDate;
            faculty.reportingManager = reportingManager;
            faculty.noticePeriod = noticePeriod;
            await faculty.save({ session });

            if (faculty.isNew) {
              facultyCreated++;
            } else {
              facultyUpdated++;
            }
          } else {
            // Create new faculty for existing user
            const [newFaculty] = await Faculty.create(
              [
                {
                  userId: user._id,
                  departmentId,
                  salutation,
                  firstName,
                  lastName,
                  primaryPhone,
                  secondaryPhone,
                  employeeId: cleanEmployeeId,
                  designation,
                  qualification,
                  workType,
                  joiningDate,
                  reportingManager,
                  noticePeriod
                }
              ],
              { session }
            );
            faculty = newFaculty;
            facultyCreated++;
          }
        }
      } catch (error) {
        failedRows.push({
          row: rowNumber,
          message: error.message
        });
      }
    }

    // Decide commit or abort based on errors
    if (failedRows.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return next(
        new AppError(
          'Bulk upload failed due to errors in some rows. No changes were saved.',
          400,
          {
            usersCreated: 0,
            usersUpdated: 0,
            facultyCreated: 0,
            facultyUpdated: 0,
            failedCount: failedRows.length,
            failedRows
          }
        )
      );
    } else {
      await session.commitTransaction();
      session.endSession();
      return res.json({
        success: true,
        message: 'Faculty upload sync completed successfully',
        data: {
          usersCreated,
          usersUpdated,
          facultyCreated,
          facultyUpdated,
          failedCount: 0,
          failedRows: []
        }
      });
    }
  } catch (error) {
    if (session) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
    }
    return next(error);
  }
};

export const getAllFaculty = async (req, res, next) => {
  try {
    const { departmentId, designation, employmentStatus } = req.query;
    const filter = {};

    if (departmentId) {
      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid departmentId',
          data: {}
        });
      }
      filter.departmentId = departmentId;
    }

    if (designation) filter.designation = designation;
    if (employmentStatus) filter.employmentStatus = employmentStatus;

    const facultyList = await Faculty.find(filter)
      .sort({ firstName: 1 })
      .populate('userId', 'email role isActive gender dateOfBirth')
      .populate('departmentId', 'name code')
      .populate(
        'reportingManager',
        'firstName lastName employeeId designation'
      );

    const formattedFacultyList = facultyList.map(
      FacultyHelper.flattenFacultyUserIsActive
    );

    return res.json({
      success: true,
      message: 'Faculty list retrieved successfully',
      data: { facultyList: formattedFacultyList }
    });
  } catch (error) {
    return next(error);
  }
};

export const getDepartmentWise = async (req, res, next) => {
  try {
    const result = await Faculty.aggregate([
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
      {
        $unwind: {
          path: '$department',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          departmentId: '$_id',
          departmentName: '$department.name',
          departmentCode: '$department.code',
          count: 1
        }
      },
      { $sort: { departmentName: 1 } }
    ]);

    return res.json({
      success: true,
      message: 'Department wise counts retrieved successfully',
      data: { result }
    });
  } catch (error) {
    return next(error);
  }
};

export const getDepartmentWiseFaculty = async (req, res, next) => {
  try {
    const { department } = req.params; // expecting department ID

    if (!mongoose.Types.ObjectId.isValid(department)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department ID format',
        data: {}
      });
    }

    const dept = await Department.findById(department);
    if (!dept) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
        data: {}
      });
    }

    const rows = await Faculty.aggregate([
      { $match: { departmentId: dept._id } },
      {
        $group: {
          _id: '$designation',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const designationSummary = rows.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const categorySummary = {
      deansAndHods: 0,
      professors: 0,
      associateAssistant: 0,
      others: 0
    };

    rows.forEach((row) => {
      const key = String(row._id || '').toLowerCase();
      if (key.includes('dean') || key.includes('hod')) {
        categorySummary.deansAndHods += row.count;
      } else if (key === 'professor') {
        categorySummary.professors += row.count;
      } else if (key.includes('associate') || key.includes('assistant')) {
        categorySummary.associateAssistant += row.count;
      } else {
        categorySummary.others += row.count;
      }
    });

    return res.json({
      success: true,
      message: 'Department wise faculty summary retrieved successfully',
      data: {
        department: {
          _id: dept._id,
          name: dept.name,
          code: dept.code
        },
        total: rows.reduce((sum, row) => sum + row.count, 0),
        designationSummary,
        categorySummary
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getDepartmentWiseFacultyList = async (req, res, next) => {
  try {
    const { department } = req.params; // expecting department ID

    if (!mongoose.Types.ObjectId.isValid(department)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department ID format',
        data: {}
      });
    }

    const dept = await Department.findById(department);
    if (!dept) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
        data: {}
      });
    }

    const faculty = await Faculty.find({ departmentId: dept._id })
      .sort({ firstName: 1, lastName: 1 })
      .populate('userId', 'email role isActive gender dateOfBirth')
      .populate('departmentId', 'name code');

    const formattedFaculty = faculty.map(
      FacultyHelper.flattenFacultyUserIsActive
    );

    return res.json({
      success: true,
      message: 'Department wise faculty list retrieved successfully',
      data: {
        total: formattedFaculty.length,
        faculty: formattedFaculty
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const total = await Faculty.countDocuments();

    const agg = await Faculty.aggregate([
      {
        $addFields: {
          des: { $toLower: '$designation' }
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $regexMatch: { input: '$des', regex: 'hod|dean' } },
              'deanHod',
              {
                $cond: [
                  { $regexMatch: { input: '$des', regex: 'assistant' } },
                  'assistant',
                  {
                    $cond: [
                      { $regexMatch: { input: '$des', regex: 'associate' } },
                      'associate',
                      {
                        $cond: [
                          {
                            $regexMatch: { input: '$des', regex: 'professor' }
                          },
                          'professor',
                          'other'
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = agg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    return res.json({
      success: true,
      message: 'Dashboard stats retrieved successfully',
      data: {
        totalFaculty: total,
        deansAndHods: stats.deanHod || 0,
        professors: stats.professor || 0,
        associateAssistant: (stats.associate || 0) + (stats.assistant || 0),
        others: stats.other || 0
      }
    });
  } catch (error) {
    return next(error);
  }
};
