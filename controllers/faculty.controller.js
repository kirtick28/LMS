import mongoose from 'mongoose';
import xlsx from 'xlsx';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import Department from '../models/Department.js';

const normalizeKey = (key) =>
  key.toString().trim().toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, '');

const getNorm = (normalized, ...variants) => {
  for (const variant of variants) {
    if (
      normalized[variant] !== undefined &&
      normalized[variant] !== null &&
      normalized[variant] !== ''
    ) {
      return normalized[variant];
    }
  }
  return undefined;
};

const clean = (value) =>
  String(value || '')
    .replace(/['"]+/g, '')
    .trim();

const normalizeCode = (value) => {
  if (!value) return '';
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
};

const normalizePhone = (value) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (/^[0-9]{10}$/.test(digits)) return digits;
  return null; // Return null if invalid instead of generating randoms for better data quality
};

const normalizeDesignation = (rawDesignation) => {
  const cleaned = clean(rawDesignation) || 'Faculty';
  const key = cleaned.toLowerCase().replace(/\s+/g, ' ').trim();

  const map = {
    professor: 'Professor',
    'assistant professor': 'Assistant Professor',
    'associate professor': 'Associate Professor',
    hod: 'HOD',
    dean: 'Dean',
    faculty: 'Faculty',
    'professor of practice': 'Professor of Practice',
    'lab technician': 'Lab Technician',
    'department secretary': 'Department Secretary',
    'senior lab technician': 'Senior Lab Technician'
  };

  return map[key] || 'Faculty';
};

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'number') {
    const serialDate = xlsx.SSF.parse_date_code(value);
    if (!serialDate) return null;
    return new Date(serialDate.y, serialDate.m - 1, serialDate.d);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeExcelRow = (row) => {
  const normalized = {};

  for (const [key, value] of Object.entries(row || {})) {
    normalized[normalizeKey(key)] = value;
  }

  return {
    email: clean(
      getNorm(normalized, 'email', 'emailaddress', 'mail', 'mailid')
    ).toLowerCase(),
    password: clean(getNorm(normalized, 'password', 'pass')),
    firstName: clean(getNorm(normalized, 'firstname', 'fname', 'name')),
    lastName: clean(getNorm(normalized, 'lastname', 'lname', 'surname')),
    primaryPhone: clean(
      getNorm(
        normalized,
        'primaryphone',
        'mobilenumber',
        'mobile',
        'phone',
        'phone1'
      )
    ),
    secondaryPhone: clean(
      getNorm(
        normalized,
        'secondaryphone',
        'alternatenumber',
        'altphone',
        'phone2',
        'mobile2'
      )
    ),
    employeeId: clean(
      getNorm(normalized, 'employeeid', 'empid', 'employeecode')
    ).toUpperCase(),
    designation: getNorm(normalized, 'designation', 'role'),
    departmentName: clean(
      getNorm(normalized, 'departmentname', 'department', 'dept')
    ),
    departmentCode: clean(
      getNorm(normalized, 'departmentcode', 'deptcode', 'code')
    ),
    qualification: clean(getNorm(normalized, 'qualification')),
    workType: clean(getNorm(normalized, 'worktype', 'employmenttype')),
    joiningDate: getNorm(normalized, 'joiningdate', 'doj'),
    reportingManager: clean(
      getNorm(normalized, 'reportingmanager', 'managerid')
    ),
    noticePeriod: clean(getNorm(normalized, 'noticeperiod')),
    salutation: clean(getNorm(normalized, 'salutation')),
    gender: clean(getNorm(normalized, 'gender')),
    dateOfBirth: getNorm(normalized, 'dateofbirth', 'dob')
  };
};

const resolveDepartment = async (payload) => {
  const departmentId = clean(payload.departmentId);

  if (departmentId) {
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      throw new Error('Invalid departmentId');
    }

    const existing = await Department.findById(departmentId);
    if (!existing) throw new Error('Invalid departmentId');
    return existing;
  }

  const departmentName = clean(payload.departmentName || payload.department);
  const departmentCode = normalizeCode(payload.departmentCode || payload.code);

  if (!departmentName) {
    throw new Error('departmentId or departmentName is required');
  }

  const existing = await Department.findOne({
    $or: [
      { name: departmentName },
      ...(departmentCode ? [{ code: departmentCode }] : [])
    ]
  });

  if (existing) return existing;

  return Department.create({
    name: departmentName,
    code: departmentCode || normalizeCode(departmentName),
    program: 'B.E.',
    isActive: true
  });
};

const resolveDepartmentFromParam = async (departmentParam) => {
  const cleaned = clean(departmentParam);

  if (mongoose.Types.ObjectId.isValid(cleaned)) {
    const byId = await Department.findById(cleaned);
    if (byId) return byId;
  }

  return Department.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${cleaned}$`, 'i') } },
      { code: { $regex: new RegExp(`^${cleaned}$`, 'i') } }
    ]
  });
};

export const addFaculty = async (req, res) => {
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
      password
    } = req.body;

    console.log(req.body);
    if (!email || !firstName || !lastName || !employeeId || !primaryPhone) {
      return res.status(400).json({
        success: false,
        message:
          'email, firstName, lastName, employeeId and primaryPhone are required',
        data: {}
      });
    }

    const cleanEmail = clean(email).toLowerCase();
    const cleanEmployeeId = clean(employeeId).toUpperCase();

    const [existingUser, existingEmployee] = await Promise.all([
      User.findOne({ email: cleanEmail }),
      Faculty.findOne({ employeeId: cleanEmployeeId })
    ]);

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
        data: {}
      });
    }

    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Faculty already exists with this employeeId',
        data: {}
      });
    }

    const department = await resolveDepartment(req.body);

    const user = await User.create({
      email: cleanEmail,
      password: password || '123456',
      role: 'FACULTY',
      gender,
      dateOfBirth: parseDateValue(dateOfBirth) || undefined
    });

    const faculty = await Faculty.create({
      userId: user._id,
      departmentId: department._id,
      salutation,
      firstName: clean(firstName),
      lastName: clean(lastName),
      primaryPhone: normalizePhone(primaryPhone),
      secondaryPhone: normalizePhone(secondaryPhone) || null,
      employeeId: cleanEmployeeId,
      designation: normalizeDesignation(designation),
      qualification,
      workType,
      joiningDate: parseDateValue(joiningDate),
      reportingManager: reportingManager || null,
      noticePeriod
    });

    return res.status(201).json({
      success: true,
      message: 'Faculty created successfully',
      data: { faculty }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const updateFaculty = async (req, res) => {
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

    if (req.body.email) {
      const updatedEmail = clean(req.body.email).toLowerCase();

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

    if (req.body.password) user.password = req.body.password;
    if (req.body.gender !== undefined) user.gender = req.body.gender;

    if (req.body.dateOfBirth !== undefined) {
      user.dateOfBirth = parseDateValue(req.body.dateOfBirth);
    }

    if (req.body.isActive !== undefined) {
      user.isActive = !!req.body.isActive;
    }

    const fields = [
      'salutation',
      'firstName',
      'lastName',
      'qualification',
      'workType',
      'noticePeriod',
      'employmentStatus'
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        faculty[field] = req.body[field];
      }
    });

    if (req.body.primaryPhone !== undefined) {
      faculty.primaryPhone = normalizePhone(req.body.primaryPhone);
    }

    if (req.body.secondaryPhone !== undefined) {
      faculty.secondaryPhone = normalizePhone(req.body.secondaryPhone) || null;
    }

    if (req.body.employeeId !== undefined) {
      const nextEmployeeId = clean(req.body.employeeId).toUpperCase();

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

    if (req.body.designation !== undefined) {
      faculty.designation = normalizeDesignation(req.body.designation);
    }

    if (req.body.joiningDate !== undefined) {
      faculty.joiningDate = parseDateValue(req.body.joiningDate);
    }

    if (req.body.reportingManager !== undefined) {
      faculty.reportingManager = req.body.reportingManager || null;
    }

    if (
      req.body.departmentId !== undefined ||
      req.body.departmentName !== undefined ||
      req.body.department !== undefined
    ) {
      const department = await resolveDepartment(req.body);
      faculty.departmentId = department._id;
    }

    await Promise.all([faculty.save(), user.save()]);

    return res.json({
      success: true,
      message: 'Faculty updated successfully',
      data: { faculty }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const deleteFaculty = async (req, res) => {
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

    await Promise.all([
      User.findByIdAndDelete(faculty.userId),
      Faculty.findByIdAndDelete(faculty._id)
    ]);

    return res.json({
      success: true,
      message: 'Faculty deleted successfully',
      data: {}
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const uploadMultipleFaculty = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        data: {}
      });
    }

    const workbook = req.file.buffer
      ? xlsx.read(req.file.buffer, { type: 'buffer' })
      : xlsx.readFile(req.file.path);

    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let usersCreated = 0;
    let usersUpdated = 0;
    let facultyCreated = 0;
    let facultyUpdated = 0;
    const failedRows = [];

    for (let index = 0; index < rows.length; index++) {
      const rowNumber = index + 2;

      try {
        const payload = normalizeExcelRow(rows[index]);

        if (
          !payload.email ||
          !payload.firstName ||
          !payload.lastName ||
          !payload.employeeId ||
          !payload.primaryPhone
        ) {
          throw new Error(
            'email, firstName, lastName, employeeId and primaryPhone are required'
          );
        }

        const department = await resolveDepartment(payload);

        let user = await User.findOne({ email: payload.email });
        let faculty = await Faculty.findOne({ employeeId: payload.employeeId });

        if (!user && !faculty) {
          user = await User.create({
            email: payload.email,
            password: payload.password || 'sece@123',
            role: 'FACULTY',
            gender: payload.gender || undefined,
            dateOfBirth: parseDateValue(payload.dateOfBirth) || undefined
          });
          usersCreated++;

          faculty = await Faculty.create({
            userId: user._id,
            departmentId: department._id,
            salutation: payload.salutation || undefined,
            firstName: payload.firstName,
            lastName: payload.lastName,
            primaryPhone: normalizePhone(payload.primaryPhone),
            secondaryPhone: normalizePhone(payload.secondaryPhone) || null,
            employeeId: payload.employeeId,
            designation: normalizeDesignation(payload.designation),
            qualification: payload.qualification || undefined,
            workType: payload.workType || undefined,
            joiningDate: parseDateValue(payload.joiningDate) || undefined,
            reportingManager: payload.reportingManager || null,
            noticePeriod: payload.noticePeriod || undefined
          });
          facultyCreated++;

          continue;
        }

        if (!user && faculty) {
          user = await User.create({
            email: payload.email,
            password: payload.password || '123456',
            role: 'FACULTY',
            gender: payload.gender || undefined,
            dateOfBirth: parseDateValue(payload.dateOfBirth) || undefined
          });
          usersCreated++;

          faculty.userId = user._id;
        } else if (user) {
          user.gender = payload.gender || user.gender;
          const parsedDob = parseDateValue(payload.dateOfBirth);
          if (parsedDob) user.dateOfBirth = parsedDob;
          if (user.role !== 'FACULTY') {
            user.role = 'FACULTY';
          }
          usersUpdated++;

          if (!faculty) {
            faculty = await Faculty.findOne({ userId: user._id });
          }
        }

        if (faculty) {
          faculty.departmentId = department._id;
          faculty.salutation = payload.salutation || faculty.salutation;
          faculty.firstName = payload.firstName || faculty.firstName;
          faculty.lastName = payload.lastName || faculty.lastName;
          faculty.primaryPhone = normalizePhone(
            payload.primaryPhone || faculty.primaryPhone
          );
          faculty.secondaryPhone =
            normalizePhone(payload.secondaryPhone) || faculty.secondaryPhone;
          faculty.employeeId = payload.employeeId || faculty.employeeId;
          faculty.designation = normalizeDesignation(
            payload.designation || faculty.designation
          );
          faculty.qualification =
            payload.qualification || faculty.qualification;
          faculty.workType = payload.workType || faculty.workType;
          faculty.noticePeriod = payload.noticePeriod || faculty.noticePeriod;

          const parsedJoining = parseDateValue(payload.joiningDate);
          if (parsedJoining) faculty.joiningDate = parsedJoining;

          if (payload.reportingManager !== undefined) {
            faculty.reportingManager = payload.reportingManager || null;
          }

          if (faculty.isNew) {
            facultyCreated++;
          } else {
            facultyUpdated++;
          }

          await faculty.save();
        } else {
          faculty = await Faculty.create({
            userId: user._id,
            departmentId: department._id,
            salutation: payload.salutation || undefined,
            firstName: payload.firstName,
            lastName: payload.lastName,
            primaryPhone: normalizePhone(payload.primaryPhone),
            secondaryPhone: normalizePhone(payload.secondaryPhone) || null,
            employeeId: payload.employeeId,
            designation: normalizeDesignation(payload.designation),
            qualification: payload.qualification || undefined,
            workType: payload.workType || undefined,
            joiningDate: parseDateValue(payload.joiningDate) || undefined,
            reportingManager: payload.reportingManager || null,
            noticePeriod: payload.noticePeriod || undefined
          });
          facultyCreated++;
        }

        await user.save();
      } catch (error) {
        failedRows.push({
          row: rowNumber,
          message: error.message
        });
      }
    }

    return res.json({
      success: true,
      message: 'Faculty upload sync completed',
      data: {
        usersCreated,
        usersUpdated,
        facultyCreated,
        facultyUpdated,
        failedCount: failedRows.length,
        failedRows
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getAllFaculty = async (req, res) => {
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

    return res.json({
      success: true,
      message: 'Faculty list retrieved successfully',
      data: { facultyList }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getDepartmentWise = async (req, res) => {
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
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getDepartmentWiseFaculty = async (req, res) => {
  try {
    const department = await resolveDepartmentFromParam(req.params.department);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
        data: {}
      });
    }

    const rows = await Faculty.aggregate([
      { $match: { departmentId: department._id } },
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
          _id: department._id,
          name: department.name,
          code: department.code
        },
        total: rows.reduce((sum, row) => sum + row.count, 0),
        designationSummary,
        categorySummary
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getDepartmentWiseFacultyList = async (req, res) => {
  try {
    const department = await resolveDepartmentFromParam(req.params.department);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
        data: {}
      });
    }

    const faculty = await Faculty.find({ departmentId: department._id })
      .sort({ firstName: 1, lastName: 1 })
      .populate('userId', 'email role isActive gender dateOfBirth')
      .populate('departmentId', 'name code');

    return res.json({
      success: true,
      message: 'Department wise faculty list retrieved successfully',
      data: {
        total: faculty.length,
        faculty
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};

export const getDashboardStats = async (req, res) => {
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
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {}
    });
  }
};
