import mongoose from "mongoose";
import xlsx from "xlsx";
import Faculty from "../models/Faculty.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import AppError from "../utils/AppError.js";
import FacultyHelper from "../utils/FacultyHelper.js";

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
      departmentId, // directly from body
    } = req.body;

    // Required fields validation
    const requiredFields = [
      "salutation",
      "firstName",
      "lastName",
      "gender",
      "dateOfBirth",
      "email",
      "primaryPhone",
      "qualification",
      "workType",
      "employeeId",
      "joiningDate",
      "designation",
      "departmentId",
    ];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `${field} is required`,
          data: {},
        });
      }
    }

    const cleanEmail = FacultyHelper.clean(email).toLowerCase();
    const cleanEmployeeId = FacultyHelper.clean(employeeId).toUpperCase();

    // Check for existing user / faculty within session
    const [existingUser, existingEmployee] = await Promise.all([
      User.findOne({ email: cleanEmail }).session(session),
      Faculty.findOne({ employeeId: cleanEmployeeId }).session(session),
    ]);

    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
        data: {},
      });
    }
    if (existingEmployee) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Faculty already exists with this employeeId",
        data: {},
      });
    }

    // Validate department
    const department = await FacultyHelper.validateDepartmentId(
      departmentId,
      session,
    );

    // Parse dates
    const parsedDOB = FacultyHelper.parseDateValue(dateOfBirth);
    const parsedJoining = FacultyHelper.parseDateValue(joiningDate);
    if (!parsedDOB || !parsedJoining) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid date format for dateOfBirth or joiningDate",
        data: {},
      });
    }

    // Normalize phone numbers
    const normPrimaryPhone = FacultyHelper.normalizePhone(primaryPhone);
    if (!normPrimaryPhone) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "primaryPhone must be a valid 10-digit number",
        data: {},
      });
    }
    const normSecondaryPhone =
      FacultyHelper.normalizePhone(secondaryPhone) || null;

    // Normalize designation
    const normDesignation = FacultyHelper.normalizeDesignation(designation);

    // Validate workType against enum
    const validWorkTypes = ["Full Time", "Contract", "Part Time", "Visiting"];
    const normWorkType = FacultyHelper.normalizeWorkType(workType);
    if (!normWorkType || !validWorkTypes.includes(normWorkType)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `workType must be one of: ${validWorkTypes.join(", ")}`,
        data: {},
      });
    }

    // Create user
    const [user] = await User.create(
      [
        {
          email: cleanEmail,
          password: password || "sece@123",
          role: "FACULTY",
          gender,
          dateOfBirth: parsedDOB,
        },
      ],
      { session },
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
          noticePeriod: FacultyHelper.clean(noticePeriod) || undefined,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Faculty and User created successfully",
      data: { faculty },
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
        message: "Invalid faculty id",
        data: {},
      });
    }

    const faculty = await Faculty.findById(id);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
        data: {},
      });
    }

    const user = await User.findById(faculty.userId).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Linked user not found",
        data: {},
      });
    }

    // Handle email update
    if (req.body.email !== undefined) {
      const updatedEmail = FacultyHelper.clean(req.body.email).toLowerCase();
      const duplicateEmail = await User.findOne({
        email: updatedEmail,
        _id: { $ne: user._id },
      });
      if (duplicateEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
          data: {},
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
          message: "Invalid dateOfBirth format",
          data: {},
        });
      }
      user.dateOfBirth = parsed;
    }
    if (req.body.isActive !== undefined) {
      user.isActive = !!req.body.isActive;
    }

    // Handle faculty simple fields
    const simpleFields = [
      "salutation",
      "firstName",
      "lastName",
      "qualification",
      "noticePeriod",
      "employmentStatus",
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
          message: "primaryPhone must be a valid 10-digit number",
          data: {},
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
        req.body.employeeId,
      ).toUpperCase();
      const duplicateEmployee = await Faculty.findOne({
        employeeId: nextEmployeeId,
        _id: { $ne: faculty._id },
      });
      if (duplicateEmployee) {
        return res.status(400).json({
          success: false,
          message: "employeeId already in use",
          data: {},
        });
      }
      faculty.employeeId = nextEmployeeId;
    }

    // Handle designation
    if (req.body.designation !== undefined) {
      faculty.designation = FacultyHelper.normalizeDesignation(
        req.body.designation,
      );
    }

    // Handle workType
    if (req.body.workType !== undefined) {
      const validWorkTypes = ["Full Time", "Contract", "Part Time", "Visiting"];
      const normWorkType = FacultyHelper.normalizeWorkType(req.body.workType);
      if (!normWorkType || !validWorkTypes.includes(normWorkType)) {
        return res.status(400).json({
          success: false,
          message: `workType must be one of: ${validWorkTypes.join(", ")}`,
          data: {},
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
          message: "Invalid joiningDate format",
          data: {},
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
        req.body.departmentId,
      );
      faculty.departmentId = department._id;
    }

    await Promise.all([faculty.save(), user.save()]);

    return res.json({
      success: true,
      message: "Faculty updated successfully",
      data: { faculty },
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
        message: "Invalid faculty id",
        data: {},
      });
    }

    const faculty = await Faculty.findById(id);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
        data: {},
      });
    }

    const user = await User.findById(faculty.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Linked user not found",
        data: {},
      });
    }

    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      message: "Faculty deactivated successfully",
      data: {},
    });
  } catch (error) {
    return next(error);
  }
};

const uploadMultipleFacultyLegacy = async (req, res, next) => {
  let session;
  try {
    if (!req.file) {
      return next(new AppError("No file uploaded", 400));
    }

    // Read workbook
    const workbook = req.file.buffer
      ? xlsx.read(req.file.buffer, { type: "buffer" })
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
          "email",
          "firstName",
          "lastName",
          "employeeId",
          "primaryPhone",
          "departmentCode",
          "salutation",
          "gender",
          "dateOfBirth",
          "joiningDate",
          "qualification",
          "designation",
          "workType",
        ];
        for (const field of requiredFields) {
          if (
            payload[field] === undefined ||
            payload[field] === null ||
            String(payload[field]).trim() === ""
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
          throw new Error("primaryPhone must be a valid 10-digit number");
        }
        const secondaryPhone =
          FacultyHelper.normalizePhone(payload.secondaryPhone) || null;

        // ----- Date validation -----
        const dateOfBirth = FacultyHelper.parseDateValue(payload.dateOfBirth);
        if (!dateOfBirth) {
          throw new Error("dateOfBirth must be a valid date");
        }
        const joiningDate = FacultyHelper.parseDateValue(payload.joiningDate);
        if (!joiningDate) {
          throw new Error("joiningDate must be a valid date");
        }

        // ----- Designation validation -----
        const designation = FacultyHelper.normalizeDesignation(
          payload.designation,
        );
        const validDesignations = [
          "Professor",
          "Associate Professor",
          "Assistant Professor",
          "HOD",
          "Dean",
          "Faculty",
          "Professor of Practice",
          "Lab Technician",
          "Senior Lab Technician",
          "Department Secretary",
        ];
        if (!validDesignations.includes(designation)) {
          throw new Error(`designation "${payload.designation}" is not valid`);
        }

        // ----- WorkType validation -----
        const validWorkTypes = [
          "Full Time",
          "Contract",
          "Part Time",
          "Visiting",
        ];
        const workType = FacultyHelper.normalizeWorkType(payload.workType);
        if (!workType || !validWorkTypes.includes(workType)) {
          throw new Error(
            `workType must be one of: ${validWorkTypes.join(", ")}`,
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
          employeeId: cleanEmployeeId,
        }).session(session);

        // Case 1: Neither user nor faculty exists → create both
        if (!user && !faculty) {
          const [newUser] = await User.create(
            [
              {
                email: cleanEmail,
                password: payload.password || "sece@123",
                role: "FACULTY",
                gender,
                dateOfBirth,
              },
            ],
            { session },
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
                noticePeriod,
              },
            ],
            { session },
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
                password: payload.password || "sece@123",
                role: "FACULTY",
                gender,
                dateOfBirth,
              },
            ],
            { session },
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
          if (user.role !== "FACULTY") {
            user.role = "FACULTY";
          }
          await user.save({ session });
          usersUpdated++;

          // Find or create faculty for this user
          if (!faculty) {
            faculty = await Faculty.findOne({ userId: user._id }).session(
              session,
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
                  noticePeriod,
                },
              ],
              { session },
            );
            faculty = newFaculty;
            facultyCreated++;
          }
        }
      } catch (error) {
        failedRows.push({
          row: rowNumber,
          message: error.message,
        });
      }
    }

    // Decide commit or abort based on errors
    if (failedRows.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return next(
        new AppError(
          "Bulk upload failed due to errors in some rows. No changes were saved.",
          400,
          {
            usersCreated: 0,
            usersUpdated: 0,
            facultyCreated: 0,
            facultyUpdated: 0,
            failedCount: failedRows.length,
            failedRows,
          },
        ),
      );
    } else {
      await session.commitTransaction();
      session.endSession();
      return res.json({
        success: true,
        message: "Faculty upload sync completed successfully",
        data: {
          usersCreated,
          usersUpdated,
          facultyCreated,
          facultyUpdated,
          failedCount: 0,
          failedRows: [],
        },
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

export const uploadMultipleFaculty = async (req, res, next) => {
  let session;

  try {
    if (!req.file) {
      return next(new AppError("No file uploaded", 400));
    }

    const workbook = req.file.buffer
      ? xlsx.read(req.file.buffer, { type: "buffer" })
      : xlsx.readFile(req.file.path);

    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    session = await mongoose.startSession();
    session.startTransaction();

    const departments = await Department.find({}, "_id code")
      .lean()
      .session(session);
    const deptMap = new Map(
      departments.map((dept) => [String(dept.code || "").toUpperCase(), dept._id]),
    );

    let usersCreated = 0;
    let usersUpdated = 0;
    let facultyCreated = 0;
    let facultyUpdated = 0;

    const failedRows = [];
    const preparedRows = [];

    const requiredFields = [
      "email",
      "firstName",
      "lastName",
      "employeeId",
      "primaryPhone",
      "departmentCode",
      "salutation",
      "gender",
      "dateOfBirth",
      "joiningDate",
      "qualification",
      "designation",
      "workType",
    ];
    const validDesignations = [
      "Professor",
      "Associate Professor",
      "Assistant Professor",
      "HOD",
      "Dean",
      "Faculty",
      "Professor of Practice",
      "Lab Technician",
      "Senior Lab Technician",
      "Department Secretary",
    ];
    const validWorkTypes = ["Full Time", "Contract", "Part Time", "Visiting"];
    const validGenders = ["Male", "Female", "Other"];
    const seenEmails = new Set();
    const seenEmployeeIds = new Set();

    const buildFacultyPayload = (row, userId) => ({
      userId,
      departmentId: row.departmentId,
      salutation: row.salutation,
      firstName: row.firstName,
      lastName: row.lastName,
      primaryPhone: row.primaryPhone,
      secondaryPhone: row.secondaryPhone,
      employeeId: row.cleanEmployeeId,
      designation: row.designation,
      qualification: row.qualification,
      workType: row.workType,
      joiningDate: row.joiningDate,
      reportingManager: row.reportingManager,
      noticePeriod: row.noticePeriod,
    });

    for (let index = 0; index < rows.length; index++) {
      const rowNumber = index + 2;

      try {
        const payload = FacultyHelper.normalizeExcelRow(rows[index]);

        for (const field of requiredFields) {
          if (
            payload[field] === undefined ||
            payload[field] === null ||
            String(payload[field]).trim() === ""
          ) {
            throw new Error(`${field} is required`);
          }
        }

        const departmentCode = payload.departmentCode.toUpperCase().trim();
        const departmentId = deptMap.get(departmentCode);
        if (!departmentId) {
          throw new Error(`Department code "${departmentCode}" not found`);
        }

        const primaryPhone = FacultyHelper.normalizePhone(payload.primaryPhone);
        if (!primaryPhone) {
          throw new Error("primaryPhone must be a valid 10-digit number");
        }
        const secondaryPhone =
          FacultyHelper.normalizePhone(payload.secondaryPhone) || null;

        const dateOfBirth = FacultyHelper.parseDateValue(payload.dateOfBirth);
        if (!dateOfBirth) {
          throw new Error("dateOfBirth must be a valid date");
        }

        const joiningDate = FacultyHelper.parseDateValue(payload.joiningDate);
        if (!joiningDate) {
          throw new Error("joiningDate must be a valid date");
        }

        const designation = FacultyHelper.normalizeDesignation(
          payload.designation,
        );
        if (!validDesignations.includes(designation)) {
          throw new Error(`designation "${payload.designation}" is not valid`);
        }

        const workType = FacultyHelper.normalizeWorkType(payload.workType);
        if (!workType || !validWorkTypes.includes(workType)) {
          throw new Error(
            `workType must be one of: ${validWorkTypes.join(", ")}`,
          );
        }

        const cleanEmail = payload.email.toLowerCase().trim();
        const cleanEmployeeId = payload.employeeId.toUpperCase().trim();
        const gender = payload.gender.trim();
        const password = payload.password || "sece@123";
        const reportingManager = payload.reportingManager
          ? payload.reportingManager.trim()
          : null;
        const noticePeriod = payload.noticePeriod
          ? payload.noticePeriod.trim()
          : undefined;

        if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
          throw new Error("email must be a valid email address");
        }

        if (!validGenders.includes(gender)) {
          throw new Error(
            `gender must be one of: ${validGenders.join(", ")}`,
          );
        }

        if (String(password).length < 6) {
          throw new Error("password must be at least 6 characters");
        }

        if (
          reportingManager &&
          !mongoose.Types.ObjectId.isValid(reportingManager)
        ) {
          throw new Error("reportingManager must be a valid faculty id");
        }

        if (seenEmails.has(cleanEmail)) {
          throw new Error(`Duplicate email "${cleanEmail}" inside Excel`);
        }

        if (seenEmployeeIds.has(cleanEmployeeId)) {
          throw new Error(
            `Duplicate employeeId "${cleanEmployeeId}" inside Excel`,
          );
        }

        seenEmails.add(cleanEmail);
        seenEmployeeIds.add(cleanEmployeeId);

        preparedRows.push({
          rowNumber,
          cleanEmail,
          cleanEmployeeId,
          password,
          gender,
          dateOfBirth,
          departmentId,
          salutation: payload.salutation.trim(),
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          primaryPhone,
          secondaryPhone,
          designation,
          qualification: payload.qualification.trim(),
          workType,
          joiningDate,
          reportingManager,
          noticePeriod,
        });
      } catch (error) {
        failedRows.push({
          row: rowNumber,
          message: error.message,
        });
      }
    }

    if (failedRows.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return next(
        new AppError(
          "Bulk upload failed due to errors in some rows. No changes were saved.",
          400,
          {
            usersCreated: 0,
            usersUpdated: 0,
            facultyCreated: 0,
            facultyUpdated: 0,
            failedCount: failedRows.length,
            failedRows,
          },
        ),
      );
    }

    const uniqueEmails = [...new Set(preparedRows.map((row) => row.cleanEmail))];
    const uniqueEmployeeIds = [
      ...new Set(preparedRows.map((row) => row.cleanEmployeeId)),
    ];

    const existingUsers = await User.find(
      { email: { $in: uniqueEmails } },
      "_id email",
    )
      .lean()
      .session(session);

    const existingUserIds = existingUsers.map((user) => user._id);
    const existingFaculties = await Faculty.find(
      {
        $or: [
          { employeeId: { $in: uniqueEmployeeIds } },
          ...(existingUserIds.length ? [{ userId: { $in: existingUserIds } }] : []),
        ],
      },
      "_id userId employeeId",
    )
      .lean()
      .session(session);

    const usersByEmail = new Map(
      existingUsers.map((user) => [String(user.email).toLowerCase(), user]),
    );
    const facultiesByEmployeeId = new Map(
      existingFaculties.map((faculty) => [faculty.employeeId, faculty]),
    );
    const facultiesByUserId = new Map(
      existingFaculties
        .filter((faculty) => faculty.userId)
        .map((faculty) => [String(faculty.userId), faculty]),
    );

    const newUserDocs = [];
    const userUpdateOps = [];
    const facultyCreatePlans = [];
    const facultyUpdatePlans = [];

    for (const row of preparedRows) {
      const existingUser = usersByEmail.get(row.cleanEmail) || null;
      const facultyByEmployee =
        facultiesByEmployeeId.get(row.cleanEmployeeId) || null;
      const facultyByUser = existingUser
        ? facultiesByUserId.get(String(existingUser._id)) || null
        : null;

      if (!existingUser && !facultyByEmployee) {
        newUserDocs.push({
          email: row.cleanEmail,
          password: row.password,
          role: "FACULTY",
          gender: row.gender,
          dateOfBirth: row.dateOfBirth,
        });
        facultyCreatePlans.push({
          rowNumber: row.rowNumber,
          email: row.cleanEmail,
          facultyData: buildFacultyPayload(row, null),
        });
        usersCreated++;
        facultyCreated++;
        continue;
      }

      if (!existingUser && facultyByEmployee) {
        newUserDocs.push({
          email: row.cleanEmail,
          password: row.password,
          role: "FACULTY",
          gender: row.gender,
          dateOfBirth: row.dateOfBirth,
        });
        facultyUpdatePlans.push({
          rowNumber: row.rowNumber,
          facultyId: facultyByEmployee._id,
          email: row.cleanEmail,
          update: buildFacultyPayload(row, null),
          setUserIdFromEmail: true,
        });
        usersCreated++;
        facultyUpdated++;
        continue;
      }

      usersUpdated++;
      userUpdateOps.push({
        updateOne: {
          filter: { _id: existingUser._id },
          update: {
            $set: {
              gender: row.gender,
              dateOfBirth: row.dateOfBirth,
              role: "FACULTY",
            },
          },
        },
      });

      const targetFaculty = facultyByEmployee || facultyByUser;

      if (targetFaculty) {
        facultyUpdatePlans.push({
          rowNumber: row.rowNumber,
          facultyId: targetFaculty._id,
          email: row.cleanEmail,
          update: buildFacultyPayload(
            row,
            facultyByEmployee ? undefined : existingUser._id,
          ),
          setUserIdFromEmail: false,
        });
        facultyUpdated++;
      } else {
        facultyCreatePlans.push({
          rowNumber: row.rowNumber,
          userId: existingUser._id,
          facultyData: buildFacultyPayload(row, existingUser._id),
        });
        facultyCreated++;
      }
    }

    const createdUsers = newUserDocs.length
      ? await User.create(newUserDocs, { session })
      : [];
    const createdUsersByEmail = new Map(
      createdUsers.map((user) => [String(user.email).toLowerCase(), user]),
    );

    if (userUpdateOps.length) {
      await User.bulkWrite(userUpdateOps, { session });
    }

    const facultyDocsToCreate = facultyCreatePlans.map((plan) => {
      const resolvedUserId =
        plan.userId || createdUsersByEmail.get(plan.email)?._id || null;

      if (!resolvedUserId) {
        throw new Error(
          `Unable to resolve user for faculty upload row ${plan.rowNumber}`,
        );
      }

      return {
        ...plan.facultyData,
        userId: resolvedUserId,
      };
    });

    const facultyUpdateOps = facultyUpdatePlans.map((plan) => {
      const updateData = { ...plan.update };

      if (plan.setUserIdFromEmail) {
        const createdUser = createdUsersByEmail.get(plan.email);
        if (!createdUser) {
          throw new Error(
            `Unable to resolve user for faculty update row ${plan.rowNumber}`,
          );
        }
        updateData.userId = createdUser._id;
      } else if (updateData.userId === undefined) {
        delete updateData.userId;
      }

      return {
        updateOne: {
          filter: { _id: plan.facultyId },
          update: { $set: updateData },
        },
      };
    });

    if (facultyDocsToCreate.length) {
      await Faculty.insertMany(facultyDocsToCreate, {
        session,
        ordered: true,
      });
    }

    if (facultyUpdateOps.length) {
      await Faculty.bulkWrite(facultyUpdateOps, { session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      message: "Faculty upload sync completed successfully",
      data: {
        usersCreated,
        usersUpdated,
        facultyCreated,
        facultyUpdated,
        failedCount: 0,
        failedRows: [],
      },
    });
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
          message: "Invalid departmentId",
          data: {},
        });
      }
      filter.departmentId = departmentId;
    }

    if (designation) filter.designation = designation;
    if (employmentStatus) filter.employmentStatus = employmentStatus;

    const facultyList = await Faculty.find(filter)
      .sort({ firstName: 1 })
      .populate("userId", "email role isActive gender dateOfBirth")
      .populate("departmentId", "name code")
      .populate(
        "reportingManager",
        "firstName lastName employeeId designation",
      );

    const formattedFacultyList = facultyList.map(
      FacultyHelper.flattenFacultyUserIsActive,
    );

    return res.json({
      success: true,
      message: "Faculty list retrieved successfully",
      data: { facultyList: formattedFacultyList },
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
          _id: "$departmentId",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "department",
        },
      },
      {
        $unwind: {
          path: "$department",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          departmentId: "$_id",
          departmentName: "$department.name",
          departmentCode: "$department.code",
          count: 1,
        },
      },
      { $sort: { departmentName: 1 } },
    ]);

    return res.json({
      success: true,
      message: "Department wise counts retrieved successfully",
      data: { result },
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
        message: "Invalid department ID format",
        data: {},
      });
    }

    const dept = await Department.findById(department);
    if (!dept) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
        data: {},
      });
    }

    const rows = await Faculty.aggregate([
      { $match: { departmentId: dept._id } },
      {
        $group: {
          _id: "$designation",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const designationSummary = rows.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const categorySummary = {
      deansAndHods: 0,
      professors: 0,
      associateAssistant: 0,
      others: 0,
    };

    rows.forEach((row) => {
      const key = String(row._id || "").toLowerCase();
      if (key.includes("dean") || key.includes("hod")) {
        categorySummary.deansAndHods += row.count;
      } else if (key === "professor") {
        categorySummary.professors += row.count;
      } else if (key.includes("associate") || key.includes("assistant")) {
        categorySummary.associateAssistant += row.count;
      } else {
        categorySummary.others += row.count;
      }
    });

    return res.json({
      success: true,
      message: "Department wise faculty summary retrieved successfully",
      data: {
        department: {
          _id: dept._id,
          name: dept.name,
          code: dept.code,
        },
        total: rows.reduce((sum, row) => sum + row.count, 0),
        designationSummary,
        categorySummary,
      },
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
        message: "Invalid department ID format",
        data: {},
      });
    }

    const dept = await Department.findById(department);
    if (!dept) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
        data: {},
      });
    }

    const faculty = await Faculty.find({ departmentId: dept._id })
      .sort({ firstName: 1, lastName: 1 })
      .populate("userId", "email role isActive gender dateOfBirth")
      .populate("departmentId", "name code");

    const formattedFaculty = faculty.map(
      FacultyHelper.flattenFacultyUserIsActive,
    );

    return res.json({
      success: true,
      message: "Department wise faculty list retrieved successfully",
      data: {
        total: formattedFaculty.length,
        faculty: formattedFaculty,
      },
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
          des: { $toLower: "$designation" },
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $regexMatch: { input: "$des", regex: "hod|dean" } },
              "deanHod",
              {
                $cond: [
                  { $regexMatch: { input: "$des", regex: "assistant" } },
                  "assistant",
                  {
                    $cond: [
                      { $regexMatch: { input: "$des", regex: "associate" } },
                      "associate",
                      {
                        $cond: [
                          {
                            $regexMatch: { input: "$des", regex: "professor" },
                          },
                          "professor",
                          "other",
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = agg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    return res.json({
      success: true,
      message: "Dashboard stats retrieved successfully",
      data: {
        totalFaculty: total,
        deansAndHods: stats.deanHod || 0,
        professors: stats.professor || 0,
        associateAssistant: (stats.associate || 0) + (stats.assistant || 0),
        others: stats.other || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyInfo = async (req, res, next) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
        data: {},
      });
    }

    const faculty = await Faculty.findOne({ userId })
      .populate("userId", "email role isActive gender dateOfBirth")
      .populate("departmentId", "name code")
      .populate(
        "reportingManager",
        "firstName lastName employeeId designation",
      );

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
        data: {},
      });
    }

    const formatted = FacultyHelper.flattenFacultyUserIsActive(faculty);

    return res.json({
      success: true,
      message: "Faculty profile retrieved successfully",
      data: { faculty: formatted },
    });
  } catch (error) {
    return next(error);
  }
};
