import mongoose from 'mongoose';
import CoursePlan from '../models/CoursePlan.js';
import Subject from '../models/Subject.js';
import SubjectComponent from '../models/SubjectComponent.js';
import Section from '../models/Section.js';
import AcademicYear from '../models/AcademicYear.js';
import FacultyAssignment from '../models/FacultyAssignment.js';
import Faculty from '../models/Faculty.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

export const getCoursePlan = catchAsync(async (req, res, next) => {
  const { subjectId, sectionId, academicYearId } = req.query;

  if (!subjectId || !sectionId || !academicYearId) {
    return next(new AppError('Missing required params', 400));
  }

  const coursePlan = await CoursePlan.findOne({
    subjectId,
    sectionId,
    academicYearId
  })
    .populate('subjectId', 'name code deliveryType credits')
    .populate(
      'faculties.facultyId',
      'firstName lastName designation employeeId userId'
    );

  if (!coursePlan) {
    return next(new AppError('Course plan not found', 404));
  }

  const loggedInFaculty = coursePlan.faculties.find(
    (f) => f.facultyId.userId?.toString() === req.user._id.toString()
  );

  const outcomes = coursePlan.courseDetails?.outcomes || [];

  const populatedCoPoMapping = outcomes.map((co) => {
    const existing = coursePlan.coPoMapping?.find(
      (m) => m.coId?.toString() === co._id.toString()
    );
    return existing || { coId: co._id, mappings: {} };
  });

  const populatedTheory = outcomes.map((co) => {
    const existing = coursePlan.theory?.find(
      (t) => t.coId?.toString() === co._id.toString()
    );
    return existing || { coId: co._id, topics: [] };
  });

  const populatedLab = outcomes.map((co) => {
    const existing = coursePlan.lab?.find(
      (l) => l.coId?.toString() === co._id.toString()
    );
    return existing || { coId: co._id, experiments: [] };
  });

  const coursePlanObj = coursePlan.toObject();
  coursePlanObj.coPoMapping = populatedCoPoMapping;
  coursePlanObj.theory = populatedTheory;
  coursePlanObj.lab = populatedLab;

  return res.status(200).json({
    success: true,
    data: {
      coursePlan: coursePlanObj,
      courseOutcomes: outcomes,
      currentUserDetails: loggedInFaculty?.facultyId || null
    }
  });
});

export const upsertCoursePlan = catchAsync(async (req, res, next) => {
  const { subjectId, sectionId, academicYearId } = req.body;

  if (!subjectId || !sectionId || !academicYearId) {
    return next(new AppError('Missing identifiers', 400));
  }

  // Validate references
  const [subject, section, academicYear] = await Promise.all([
    Subject.findById(subjectId),
    Section.findById(sectionId),
    AcademicYear.findById(academicYearId)
  ]);

  if (!subject || !section || !academicYear) {
    return next(new AppError('Invalid IDs', 404));
  }

  // Faculty authorization
  const components = await SubjectComponent.find({ subjectId });
  const componentIds = components.map((c) => c._id);
  const assignments = await FacultyAssignment.find({
    subjectComponentId: { $in: componentIds },
    sectionId,
    academicYearId,
    status: 'active'
  });

  if (!assignments.length) {
    return next(new AppError('No faculty assigned', 403));
  }

  const assignedFacultyIds = new Set();
  assignments.forEach((a) =>
    a.facultyIds.forEach((id) => assignedFacultyIds.add(id.toString()))
  );

  if (req.user.role === 'FACULTY') {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty || !assignedFacultyIds.has(faculty._id.toString())) {
      return next(new AppError('Unauthorized', 403));
    }
  }

  // Find existing plan (or create empty skeleton)
  let coursePlan = await CoursePlan.findOne({
    subjectId,
    sectionId,
    academicYearId
  });
  const isNew = !coursePlan;

  // --- 1. Process Course Outcomes (COs) ---
  const incomingOutcomes = req.body.courseDetails?.outcomes;
  let finalOutcomes = coursePlan?.courseDetails?.outcomes || [];

  if (incomingOutcomes) {
    // Build new outcomes array with reindexed codes and preserved _ids where possible
    finalOutcomes = incomingOutcomes.map((incoming, idx) => {
      const existing = coursePlan?.courseDetails?.outcomes?.find(
        (ex) => ex._id?.toString() === incoming._id?.toString()
      );
      return {
        _id: existing?._id || new mongoose.Types.ObjectId(),
        code: `CO${idx + 1}`,
        statement: incoming.statement,
        rtbl: incoming.rtbl || 'K1'
      };
    });
  }

  const validCoIds = new Set(finalOutcomes.map((co) => co._id.toString()));

  // --- 2. Helper to filter dependent data by valid CO ids ---
  const filterByValidCoIds = (items) => {
    if (!items) return [];
    return items.filter(
      (item) => item.coId && validCoIds.has(item.coId.toString())
    );
  };

  // --- 3. Process dependent arrays (replace if provided, else keep & filter) ---
  let finalCoPoMapping = filterByValidCoIds(coursePlan?.coPoMapping || []);
  let finalTheory = filterByValidCoIds(coursePlan?.theory || []);
  let finalLab = filterByValidCoIds(coursePlan?.lab || []);

  if (req.body.coPoMapping !== undefined) {
    finalCoPoMapping = filterByValidCoIds(req.body.coPoMapping);
  }
  if (req.body.theory !== undefined) {
    finalTheory = filterByValidCoIds(req.body.theory);
  }
  if (req.body.lab !== undefined) {
    finalLab = filterByValidCoIds(req.body.lab);
  }

  // --- 4. Faculty list (always recompute from assignments) ---
  const faculties = Array.from(assignedFacultyIds).map((id) => ({
    facultyId: id,
    isPrimary:
      coursePlan?.faculties?.find((f) => f.facultyId.toString() === id)
        ?.isPrimary || false
  }));

  // --- 5. Merge courseDetails (preserve non-outcome fields) ---
  const existingCourseDetails = coursePlan?.courseDetails || {};
  const incomingCourseDetails = req.body.courseDetails || {};
  const courseDetails = {
    courseType:
      incomingCourseDetails.courseType ?? existingCourseDetails.courseType,
    description:
      incomingCourseDetails.description ?? existingCourseDetails.description,
    objectives:
      incomingCourseDetails.objectives ?? existingCourseDetails.objectives,
    preRequisites:
      incomingCourseDetails.preRequisites ??
      existingCourseDetails.preRequisites,
    coRequisites:
      incomingCourseDetails.coRequisites ?? existingCourseDetails.coRequisites,
    outcomes: finalOutcomes
  };

  // --- 6. Other top-level fields ---
  const references =
    req.body.references !== undefined
      ? req.body.references
      : coursePlan?.references;
  const assessments =
    req.body.assessments !== undefined
      ? req.body.assessments
      : coursePlan?.assessments;
  const activities =
    req.body.activities !== undefined
      ? req.body.activities
      : coursePlan?.activities;
  const status =
    req.body.status !== undefined
      ? req.body.status
      : coursePlan?.status || 'Draft';

  // --- 7. Build update object ---
  const updateData = {
    subjectId,
    sectionId,
    academicYearId,
    faculties,
    courseDetails,
    coPoMapping: finalCoPoMapping,
    theory: finalTheory,
    lab: finalLab,
    references,
    assessments,
    activities,
    status
  };

  // --- 8. Perform upsert ---
  const updatedPlan = await CoursePlan.findOneAndUpdate(
    { subjectId, sectionId, academicYearId },
    { $set: updateData },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true
    }
  );

  return res.status(200).json({
    success: true,
    message: isNew
      ? 'Course plan created successfully'
      : 'Course plan updated successfully',
    data: {
      coursePlan: updatedPlan,
      courseOutcomes: updatedPlan.courseDetails.outcomes
    }
  });
});
