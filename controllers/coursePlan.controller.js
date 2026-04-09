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

  const [subject, section, academicYear] = await Promise.all([
    Subject.findById(subjectId).lean(),
    Section.findById(sectionId).lean(),
    AcademicYear.findById(academicYearId).lean()
  ]);

  if (!subject || !section || !academicYear) {
    return next(new AppError('Invalid IDs', 404));
  }

  const components = await SubjectComponent.find({ subjectId })
    .select('_id')
    .lean();
  const componentIds = components.map((c) => c._id);

  const assignments = await FacultyAssignment.find({
    subjectComponentId: { $in: componentIds },
    sectionId,
    academicYearId,
    status: 'active'
  })
    .select('facultyIds')
    .lean();

  if (!assignments.length) {
    return next(new AppError('No faculty assigned', 403));
  }

  const assignedFacultyIds = new Set();
  assignments.forEach((a) => {
    for (const id of a.facultyIds) assignedFacultyIds.add(id.toString());
  });

  if (req.user.role === 'FACULTY') {
    const faculty = await Faculty.findOne({ userId: req.user._id })
      .select('_id')
      .lean();

    if (!faculty || !assignedFacultyIds.has(faculty._id.toString())) {
      return next(new AppError('Unauthorized', 403));
    }
  }

  let coursePlan = await CoursePlan.findOne({
    subjectId,
    sectionId,
    academicYearId
  });

  const isNew = !coursePlan;

  const incomingOutcomes = req.body.courseDetails?.outcomes;

  let finalOutcomes = coursePlan?.courseDetails?.outcomes || [];

  if (incomingOutcomes) {
    const existingMap = new Map(
      (coursePlan?.courseDetails?.outcomes || []).map((o) => [
        o._id.toString(),
        o
      ])
    );

    finalOutcomes = incomingOutcomes.map((incoming, idx) => {
      const existing = existingMap.get(incoming._id?.toString());

      return {
        _id: existing?._id || new mongoose.Types.ObjectId(),
        code: `CO${idx + 1}`,
        statement: incoming.statement,
        rtbl: incoming.rtbl || 'K1'
      };
    });
  }

  const validCoIds = new Set(finalOutcomes.map((co) => co._id.toString()));

  const filterByValidCoIds = (items) => {
    if (!items) return [];

    const result = [];

    for (const item of items) {
      if (item.coId && validCoIds.has(item.coId.toString())) {
        result.push(item);
      }
    }

    return result;
  };

  let finalCoPoMapping = filterByValidCoIds(coursePlan?.coPoMapping);
  let finalTheory = filterByValidCoIds(coursePlan?.theory);
  let finalLab = filterByValidCoIds(coursePlan?.lab);

  if (req.body.coPoMapping !== undefined) {
    finalCoPoMapping = filterByValidCoIds(req.body.coPoMapping);
  }

  if (req.body.theory !== undefined) {
    finalTheory = filterByValidCoIds(req.body.theory);
  }

  if (req.body.lab !== undefined) {
    finalLab = filterByValidCoIds(req.body.lab);
  }

  const existingFacultyMap = new Map(
    (coursePlan?.faculties || []).map((f) => [f.facultyId.toString(), f])
  );

  const faculties = Array.from(assignedFacultyIds).map((id) => ({
    facultyId: id,
    isPrimary: existingFacultyMap.get(id)?.isPrimary || false
  }));

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
