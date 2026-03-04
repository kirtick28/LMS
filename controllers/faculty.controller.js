import mongoose from 'mongoose';
import xlsx from 'xlsx';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import Department from '../models/Department.js';

const DESIGNATION_ENUM = [
  'Professor',
  'Assistant Professor',
  'Associate Professor',
  'HOD',
  'Dean',
  'Faculty',
  'Professor of Practice',
  'Lab Technician',
  'Department Secretary',
  'Senior Lab Technician'
];

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
  const digits = String(value || '').replace(/\D/g, '');
  if (/^[0-9]{10}$/.test(digits)) return digits;
  return `9${Math.floor(100000000 + Math.random() * 900000000)}`;
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
    shortName: departmentCode || undefined,
    code: departmentCode || normalizeCode(departmentName),
    program: 'B.E',
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
      { shortName: { $regex: new RegExp(`^${cleaned}$`, 'i') } },
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
      mobileNumber,
      qualification,
      workType,
      employeeId,
      joiningDate,
      designation,
      reportingManager,
      noticePeriod,
      password
    } = req.body;

    if (!email || !firstName || !lastName || !employeeId || !mobileNumber) {
      return res.status(400).json({
        message:
          'email, firstName, lastName, employeeId and mobileNumber are required'
      });
    }

    const cleanEmail = clean(email).toLowerCase();
    const cleanEmployeeId = clean(employeeId).toUpperCase();

    const [existingUser, existingEmployee] = await Promise.all([
      User.findOne({ email: cleanEmail }),
      Faculty.findOne({ employeeId: cleanEmployeeId })
    ]);

    if (existingUser) {
      return res
        .status(400)
        .json({ message: 'User already exists with this email' });
    }

    if (existingEmployee) {
      return res
        .status(400)
        .json({ message: 'Faculty already exists with this employeeId' });
    }

    const department = await resolveDepartment(req.body);

    const user = await User.create({
      email: cleanEmail,
      password: password || '123456',
      role: 'FACULTY',
      profileType: 'Faculty',
      gender,
      dateOfBirth: parseDateValue(dateOfBirth) || undefined
    });

    const faculty = await Faculty.create({
      userId: user._id,
      departmentId: department._id,
      salutation,
      firstName: clean(firstName),
      lastName: clean(lastName),
      mobileNumber: normalizePhone(mobileNumber),
      employeeId: cleanEmployeeId,
      designation: normalizeDesignation(designation),
      qualification,
      workType,
      joiningDate: parseDateValue(joiningDate),
      reportingManager: reportingManager || null,
      noticePeriod
    });

    user.profileRef = faculty._id;
    await user.save();

    return res.status(201).json({
      message: 'Faculty created successfully',
      faculty
    });
  } catch (error) {
    console.error('Add Faculty Error:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const faculty = await Faculty.findById(id);

    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    const user = await User.findById(faculty.userId).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'Linked user not found' });
    }

    if (req.body.email) {
      const updatedEmail = clean(req.body.email).toLowerCase();
      const duplicateEmail = await User.findOne({
        email: updatedEmail,
        _id: { $ne: user._id }
      });

      if (duplicateEmail) {
        return res.status(400).json({ message: 'Email already in use' });
      }

      user.email = updatedEmail;
    }

    if (req.body.password) {
      user.password = req.body.password;
    }

    if (req.body.gender !== undefined) user.gender = req.body.gender;
    if (req.body.dateOfBirth !== undefined) {
      user.dateOfBirth = parseDateValue(req.body.dateOfBirth);
    }
    if (req.body.isActive !== undefined) user.isActive = !!req.body.isActive;

    const updatableFacultyFields = [
      'salutation',
      'firstName',
      'lastName',
      'qualification',
      'workType',
      'noticePeriod',
      'employmentStatus'
    ];

    updatableFacultyFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        faculty[field] = req.body[field];
      }
    });

    if (req.body.mobileNumber !== undefined) {
      faculty.mobileNumber = normalizePhone(req.body.mobileNumber);
    }

    if (req.body.employeeId !== undefined) {
      const nextEmployeeId = clean(req.body.employeeId).toUpperCase();
      const duplicateEmployee = await Faculty.findOne({
        employeeId: nextEmployeeId,
        _id: { $ne: faculty._id }
      });

      if (duplicateEmployee) {
        return res.status(400).json({ message: 'employeeId already in use' });
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

    if (req.files) {
      faculty.documents = {
        marksheet:
          req.files?.marksheet?.[0]?.path ||
          faculty.documents?.marksheet ||
          null,
        experienceCertificate:
          req.files?.experienceCertificate?.[0]?.path ||
          faculty.documents?.experienceCertificate ||
          null,
        degreeCertificate:
          req.files?.degreeCertificate?.[0]?.path ||
          faculty.documents?.degreeCertificate ||
          null
      };
    }

    await Promise.all([faculty.save(), user.save()]);

    return res.json({
      message: 'Faculty updated successfully',
      faculty
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;

    const faculty = await Faculty.findById(id);

    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    await Promise.all([
      User.findByIdAndDelete(faculty.userId),
      Faculty.findByIdAndDelete(faculty._id)
    ]);

    return res.json({ message: 'Faculty deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const uploadMultipleFaculty = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const workbook = req.file.buffer
      ? xlsx.read(req.file.buffer, { type: 'buffer' })
      : xlsx.readFile(req.file.path);

    const sheetName = workbook.SheetNames[0];
    const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      raw: true,
      defval: ''
    });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ message: 'Excel is empty or malformed' });
    }

    let usersCreated = 0;
    let usersUpdated = 0;
    let facultyCreated = 0;
    let facultyUpdated = 0;
    const failedRows = [];

    for (let i = 0; i < rawRows.length; i++) {
      try {
        const row = rawRows[i];
        const normalized = {};

        Object.keys(row).forEach((key) => {
          normalized[normalizeKey(key)] = row[key];
        });

        const email =
          clean(
            getNorm(normalized, 'email', 'mail', 'emailaddress', 'emailid')
          ) || `autogen${Date.now()}${i}@college.edu`;
        const cleanEmail = email.toLowerCase();

        const rawName = getNorm(normalized, 'name', 'fullname');
        const firstName = clean(
          getNorm(normalized, 'firstname', 'first') ||
            (rawName ? String(rawName).split(' ')[0] : `User${i + 1}`)
        );
        const lastName = clean(
          getNorm(normalized, 'lastname', 'last') ||
            (rawName
              ? String(rawName).split(' ').slice(1).join(' ')
              : `Auto${i + 1}`)
        );

        const mobileNumber = normalizePhone(
          getNorm(normalized, 'phonenumber', 'phone', 'mobile', 'mobilenumber')
        );

        const employeeId =
          clean(
            getNorm(normalized, 'employeeid', 'empid', 'employeeidnumber')
          ) || `EMP${Date.now()}${i + 1}`;

        const departmentPayload = {
          departmentId: clean(getNorm(normalized, 'departmentid')),
          departmentName:
            clean(
              getNorm(normalized, 'department', 'dept', 'departmentname')
            ) || 'General Department',
          departmentCode: clean(
            getNorm(normalized, 'departmentcode', 'deptcode')
          )
        };

        const department = await resolveDepartment(departmentPayload);

        const rawPassword =
          clean(getNorm(normalized, 'password', 'pwd')) || '123456';

        let user = await User.findOne({ email: cleanEmail });

        if (user) {
          user.role = 'FACULTY';
          user.profileType = 'Faculty';

          if (getNorm(normalized, 'gender'))
            user.gender = getNorm(normalized, 'gender');

          const dob = parseDateValue(getNorm(normalized, 'dateofbirth'));
          if (dob) user.dateOfBirth = dob;

          if (rawPassword) user.password = rawPassword;

          await user.save();
          usersUpdated++;
        } else {
          user = await User.create({
            email: cleanEmail,
            password: rawPassword,
            role: 'FACULTY',
            profileType: 'Faculty',
            gender: getNorm(normalized, 'gender') || undefined,
            dateOfBirth:
              parseDateValue(getNorm(normalized, 'dateofbirth')) || undefined
          });
          usersCreated++;
        }

        const facultyPayload = {
          departmentId: department._id,
          salutation: clean(getNorm(normalized, 'salutation')) || undefined,
          firstName,
          lastName,
          mobileNumber,
          employeeId: String(employeeId).toUpperCase(),
          designation: normalizeDesignation(getNorm(normalized, 'designation')),
          qualification:
            clean(getNorm(normalized, 'qualification')) || undefined,
          workType: clean(getNorm(normalized, 'worktype')) || undefined,
          joiningDate: parseDateValue(getNorm(normalized, 'joiningdate')),
          noticePeriod: clean(getNorm(normalized, 'noticeperiod')) || undefined,
          reportingManager:
            clean(getNorm(normalized, 'reportingmanagerid')) || null
        };

        let faculty = await Faculty.findOne({
          $or: [{ userId: user._id }, { employeeId: facultyPayload.employeeId }]
        });

        if (faculty) {
          Object.keys(facultyPayload).forEach((key) => {
            if (facultyPayload[key] !== undefined) {
              faculty[key] = facultyPayload[key];
            }
          });
          await faculty.save();
          facultyUpdated++;
        } else {
          faculty = await Faculty.create({
            userId: user._id,
            ...facultyPayload
          });
          facultyCreated++;
        }

        user.profileRef = faculty._id;
        user.profileType = 'Faculty';
        await user.save();
      } catch (rowError) {
        failedRows.push({
          row: i + 2,
          error: rowError.message || 'Unknown row error'
        });
      }
    }

    return res.status(200).json({
      message: 'Faculty + User sync completed',
      usersCreated,
      usersUpdated,
      facultyCreated,
      facultyUpdated,
      failedCount: failedRows.length,
      failedRows: failedRows.slice(0, 20)
    });
  } catch (error) {
    console.error('Upload Faculty Error:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAllFaculty = async (req, res) => {
  try {
    const { departmentId, designation, employmentStatus } = req.query;
    const filter = {};

    if (departmentId) filter.departmentId = departmentId;
    if (designation) filter.designation = designation;
    if (employmentStatus) filter.employmentStatus = employmentStatus;

    const facultyList = await Faculty.find(filter)
      .sort({ firstName: 1 })
      .populate('userId', 'email role isActive gender dateOfBirth')
      .populate('departmentId', 'name code shortName')
      .populate(
        'reportingManager',
        'firstName lastName employeeId designation'
      );

    return res.json(facultyList);
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDepartmentWiseFaculty = async (req, res) => {
  try {
    const { department } = req.params;
    const departmentDoc = await resolveDepartmentFromParam(department);

    if (!departmentDoc) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const data = await Faculty.aggregate([
      {
        $match: {
          departmentId: departmentDoc._id
        }
      },
      {
        $group: {
          _id: '$designation',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          designation: '$_id',
          count: 1
        }
      },
      { $sort: { designation: 1 } }
    ]);

    let professor = 0;
    let assistant = 0;
    let associate = 0;

    data.forEach((row) => {
      const des = String(row.designation || '').toLowerCase();
      if (des.includes('assistant')) assistant += row.count;
      else if (des.includes('associate')) associate += row.count;
      else if (des.includes('professor')) professor += row.count;
    });

    return res.json({
      departmentId: departmentDoc._id,
      departmentName: departmentDoc.name,
      byDesignation: data,
      categorySummary: [
        { Class: '1st', Designation: 'Professor', Count: professor },
        { Class: '2nd', Designation: 'Assistant Professor', Count: assistant },
        { Class: '3rd', Designation: 'Associate Professor', Count: associate }
      ]
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDepartmentWiseFacultyList = async (req, res) => {
  try {
    const { department } = req.params;

    if (!department) {
      return res.status(400).json({ message: 'Department is required' });
    }

    const departmentDoc = await resolveDepartmentFromParam(department);
    if (!departmentDoc) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const facultyList = await Faculty.find({
      departmentId: departmentDoc._id
    })
      .populate('userId', 'email role isActive')
      .sort({ firstName: 1 });

    return res.status(200).json({
      total: facultyList.length,
      faculty: facultyList.map((faculty) => ({
        _id: faculty._id,
        firstName: faculty.firstName,
        lastName: faculty.lastName,
        email: faculty.userId?.email || null,
        mobileNumber: faculty.mobileNumber,
        employeeId: faculty.employeeId,
        designation: faculty.designation,
        employmentStatus: faculty.employmentStatus,
        departmentId: faculty.departmentId
      }))
    });
  } catch (error) {
    console.error('Get Department Faculty Error:', error);
    return res.status(500).json({ message: error.message });
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

    const statusAgg = await Faculty.aggregate([
      {
        $group: {
          _id: '$employmentStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = agg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const employmentStatus = statusAgg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    return res.json({
      totalFaculty: total,
      deansAndHods: stats.deanHod || 0,
      professors: stats.professor || 0,
      associateAssistant: (stats.associate || 0) + (stats.assistant || 0),
      others: stats.other || 0,
      employmentStatus
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
