class FacultyHelper {
  /**
   * Normalize a key by removing spaces, underscores, hyphens and lowercasing
   */
  static normalizeKey(key) {
    return key
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[_-]/g, '');
  }

  /**
   * Get first non‑empty variant from normalized object
   */
  static getNorm(normalized, ...variants) {
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
  }

  /**
   * Clean a string: remove quotes, trim
   */
  static clean(value) {
    return String(value || '')
      .replace(/['"]+/g, '')
      .trim();
  }

  /**
   * Normalize a department code: uppercase, remove non‑alphanumeric, limit to 10 chars
   */
  static normalizeCode(value) {
    if (!value) return '';
    return String(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
  }

  /**
   * Normalize a phone number: extract digits, ensure 10 digits, else null
   */
  static normalizePhone(value) {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    if (/^[0-9]{10}$/.test(digits)) return digits;
    return null;
  }

  /**
   * Normalize a designation string to one of the enum values
   */
  static normalizeDesignation(rawDesignation) {
    const cleaned = FacultyHelper.clean(rawDesignation) || 'Faculty';
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
  }

  /**
   * Normalize workType to one of the enum values
   */
  static normalizeWorkType(rawWorkType) {
    if (!rawWorkType) return undefined;
    const cleaned = FacultyHelper.clean(rawWorkType);
    const lower = cleaned.toLowerCase();
    const map = {
      'full time': 'Full Time',
      fulltime: 'Full Time',
      'full-time': 'Full Time',
      'part time': 'Part Time',
      parttime: 'Part Time',
      'part-time': 'Part Time',
      contract: 'Contract',
      visiting: 'Visiting'
    };
    return map[lower] || undefined;
  }

  /**
   * Parse a date from various formats (Excel serial, string, Date object)
   */
  static parseDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) return value;

    if (typeof value === 'number') {
      const serialDate = xlsx.SSF.parse_date_code(value);
      if (!serialDate) return null;
      return new Date(serialDate.y, serialDate.m - 1, serialDate.d);
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Validate that a given ID is a valid ObjectId and that a department exists with that ID
   */
  static async validateDepartmentId(id, session = null) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid department ID format');
    }
    const query = Department.findById(id);
    if (session) query.session(session);
    const department = await query;
    if (!department) {
      throw new Error('Department not found');
    }
    return department;
  }

  /**
   * Normalize an entire Excel row into a consistent payload object
   */
  static normalizeExcelRow(row) {
    const normalized = {};

    for (const [key, value] of Object.entries(row || {})) {
      normalized[FacultyHelper.normalizeKey(key)] = value;
    }

    return {
      email: FacultyHelper.clean(
        FacultyHelper.getNorm(
          normalized,
          'email',
          'emailaddress',
          'mail',
          'mailid'
        )
      ).toLowerCase(),
      password: FacultyHelper.clean(
        FacultyHelper.getNorm(normalized, 'password', 'pass')
      ),
      firstName: FacultyHelper.clean(
        FacultyHelper.getNorm(normalized, 'firstname', 'fname', 'name')
      ),
      lastName: FacultyHelper.clean(
        FacultyHelper.getNorm(normalized, 'lastname', 'lname', 'surname')
      ),
      primaryPhone: FacultyHelper.clean(
        FacultyHelper.getNorm(
          normalized,
          'primaryphone',
          'mobilenumber',
          'mobile',
          'phone',
          'phone1'
        )
      ),
      secondaryPhone: FacultyHelper.clean(
        FacultyHelper.getNorm(
          normalized,
          'secondaryphone',
          'alternatenumber',
          'altphone',
          'phone2',
          'mobile2'
        )
      ),
      employeeId: FacultyHelper.clean(
        FacultyHelper.getNorm(normalized, 'employeeid', 'empid', 'employeecode')
      ).toUpperCase(),
      designation: FacultyHelper.getNorm(normalized, 'designation', 'role'),
      // For bulk upload we now expect departmentCode (not departmentId)
      departmentCode: FacultyHelper.clean(
        FacultyHelper.getNorm(
          normalized,
          'departmentcode',
          'deptcode',
          'code',
          'department'
        )
      ),
      qualification: FacultyHelper.clean(
        FacultyHelper.getNorm(normalized, 'qualification')
      ),
      workType: FacultyHelper.clean(
        FacultyHelper.getNorm(normalized, 'worktype', 'employmenttype')
      ),
      joiningDate: FacultyHelper.getNorm(normalized, 'joiningdate', 'doj'),
      reportingManager: FacultyHelper.clean(
        FacultyHelper.getNorm(normalized, 'reportingmanager', 'managerid')
      ),
      noticePeriod: FacultyHelper.clean(
        FacultyHelper.getNorm(normalized, 'noticeperiod')
      ),
      salutation: FacultyHelper.clean(
        FacultyHelper.getNorm(normalized, 'salutation')
      ),
      gender: FacultyHelper.clean(FacultyHelper.getNorm(normalized, 'gender')),
      dateOfBirth: FacultyHelper.getNorm(normalized, 'dateofbirth', 'dob')
    };
  }

  /**
   * Flatten user.isActive from populated userId into faculty object level
   */
  static flattenFacultyUserIsActive(facultyDoc) {
    const faculty = facultyDoc.toObject
      ? facultyDoc.toObject()
      : { ...facultyDoc };

    if (!faculty.userId || typeof faculty.userId !== 'object') {
      return {
        ...faculty,
        isActive: false
      };
    }

    const user = faculty.userId.toObject
      ? faculty.userId.toObject()
      : { ...faculty.userId };
    const isActive = !!user.isActive;
    delete user.isActive;

    return {
      ...faculty,
      userId: user,
      isActive
    };
  }
}

export default FacultyHelper;
