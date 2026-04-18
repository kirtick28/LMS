import mongoose from 'mongoose';

import Assignment from '../models/Assignment.js';
import Classroom from '../models/Classroom.js';
import ClassroomPost from '../models/ClassroomPost.js';
import Comment from '../models/Comment.js';
import Faculty from '../models/Faculty.js';
import Material from '../models/Material.js';
import Quiz from '../models/Quiz.js';
import Student from '../models/Student.js';
import Submission from '../models/Submission.js';
import Topic from '../models/Topic.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import {
  ensureClassroomAccess,
  getClassroomStudentCount,
  getClassroomStudentRoster
} from '../utils/classroomAccess.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const facultyRoles = new Set(['ADMIN', 'FACULTY', 'HOD']);

const stripHtml = (value = '') =>
  String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseMaybeJson = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeCreatorRole = (role) => (role === 'STUDENT' ? 'STUDENT' : 'FACULTY');

const normalizeLinkedAttachments = (attachments = []) =>
  (attachments || [])
    .filter((attachment) => attachment?.fileUrl)
    .map((attachment) => ({
      fileName: attachment.fileName || 'link',
      fileUrl: attachment.fileUrl,
      fileType: attachment.fileType || 'link'
    }));

const normalizeUploadedAttachments = (files = []) =>
  (files || []).map((file) => ({
    fileName: file.originalname,
    fileUrl: `/pdf/${file.filename}`,
    fileType: file.mimetype
  }));

const serializeSubmission = (submission) => {
  if (!submission) return null;

  return {
    ...submission,
    attachments: submission.attachments || [],
    quizAnswers: submission.quizAnswers || [],
    isLate: !!submission.isLate
  };
};

const getSubmissionState = ({
  submission,
  dueDate,
  allowLateSubmission = true
}) => {
  if (!submission) {
    if (dueDate && new Date(dueDate).getTime() < Date.now()) {
      return allowLateSubmission ? 'missing' : 'closed';
    }
    return 'pending';
  }

  if (submission.status === 'graded') return 'graded';
  if (submission.isLate) return 'late';
  return 'submitted';
};

const getOrCreateTopic = async (classroomId, session) => {
  let defaultTopic = await Topic.findOne({
    classroomId,
    isDefault: true
  }).session(session);

  if (!defaultTopic) {
    const created = await Topic.create(
      [
        {
          classroomId,
          name: 'No Topic',
          isDefault: true
        }
      ],
      { session }
    );

    return created[0];
  }

  return defaultTopic;
};

const getPopulatedClassroom = async (classroomId) => {
  const classroom = await Classroom.findById(classroomId)
    .populate({
      path: 'sectionId',
      select: 'name batchProgramId',
      populate: {
        path: 'batchProgramId',
        select: 'departmentId',
        populate: {
          path: 'departmentId',
          select: 'name code'
        }
      }
    })
    .populate({
      path: 'subjectId',
      select: 'name code shortName deliveryType credits'
    })
    .populate('academicYearId', 'name')
    .lean();

  if (!classroom) {
    throw new AppError('Classroom not found', 404);
  }

  const department = classroom.sectionId?.batchProgramId?.departmentId || null;

  return {
    ...classroom,
    sectionId: classroom.sectionId
      ? {
          _id: classroom.sectionId._id,
          name: classroom.sectionId.name
        }
      : null,
    department: department
      ? {
          name: department.name,
          code: department.code
        }
      : null
  };
};

const getAuthorProfiles = async (userIds = []) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean).map(String))];
  if (!uniqueUserIds.length) {
    return new Map();
  }

  const [faculties, students] = await Promise.all([
    Faculty.find({ userId: { $in: uniqueUserIds } })
      .select(
        'userId firstName lastName employeeId designation departmentId profileImage'
      )
      .populate({ path: 'departmentId', select: 'name code' })
      .lean(),
    Student.find({ userId: { $in: uniqueUserIds } })
      .select('userId firstName lastName registerNumber rollNumber sectionId')
      .lean()
  ]);

  const profileMap = new Map();

  faculties.forEach((faculty) => {
    profileMap.set(String(faculty.userId), {
      _id: faculty._id,
      userId: faculty.userId,
      firstName: faculty.firstName,
      lastName: faculty.lastName,
      designation: faculty.designation,
      employeeId: faculty.employeeId,
      department: faculty.departmentId
        ? {
            _id: faculty.departmentId._id,
            name: faculty.departmentId.name,
            code: faculty.departmentId.code
          }
        : null,
      role: 'FACULTY'
    });
  });

  students.forEach((student) => {
    profileMap.set(String(student.userId), {
      _id: student._id,
      userId: student.userId,
      firstName: student.firstName,
      lastName: student.lastName,
      registerNumber: student.registerNumber,
      rollNumber: student.rollNumber,
      role: 'STUDENT'
    });
  });

  return profileMap;
};

const getCommentsByPostId = async (postIds) => {
  if (!postIds.length) {
    return new Map();
  }

  const comments = await Comment.find({ postId: { $in: postIds } })
    .sort({ createdAt: -1 })
    .lean();

  const commentAuthorMap = await getAuthorProfiles(
    comments.map((comment) => comment.userId)
  );

  const grouped = new Map();

  comments.forEach((comment) => {
    const postId = String(comment.postId);
    if (!grouped.has(postId)) {
      grouped.set(postId, []);
    }

    grouped.get(postId).push({
      _id: comment._id,
      message: comment.message,
      createdAt: comment.createdAt,
      user: commentAuthorMap.get(String(comment.userId)) || null
    });
  });

  return grouped;
};

const hydratePosts = async ({ classroom, posts, user }) => {
  if (!posts.length) {
    return [];
  }

  const postIds = posts.map((post) => post._id);
  const authorProfileMap = await getAuthorProfiles(
    posts.map((post) => post.createdBy)
  );

  const [assignments, quizzes, materials, commentMap, totalStudents, submissions] =
    await Promise.all([
      Assignment.find({ postId: { $in: postIds } }).lean(),
      Quiz.find({ postId: { $in: postIds } }).lean(),
      Material.find({ postId: { $in: postIds } }).lean(),
      getCommentsByPostId(
        posts
          .filter((post) => post.type === 'announcement')
          .map((post) => post._id)
      ),
      getClassroomStudentCount(classroom),
      Submission.find({ postId: { $in: postIds } }).lean()
    ]);

  const assignmentMap = new Map(
    assignments.map((assignment) => [String(assignment.postId), assignment])
  );
  const quizMap = new Map(quizzes.map((quiz) => [String(quiz.postId), quiz]));
  const materialMap = new Map(
    materials.map((material) => [String(material.postId), material])
  );

  const submissionsByPostId = new Map();
  submissions.forEach((submission) => {
    const postId = String(submission.postId);
    if (!submissionsByPostId.has(postId)) {
      submissionsByPostId.set(postId, []);
    }
    submissionsByPostId.get(postId).push(serializeSubmission(submission));
  });

  return posts.map((post) => {
    const postId = String(post._id);
    const assignment = assignmentMap.get(postId) || null;
    const quiz = quizMap.get(postId) || null;
    const material = materialMap.get(postId) || null;
    const postSubmissions = submissionsByPostId.get(postId) || [];
    const mySubmission =
      user.role === 'STUDENT'
        ? postSubmissions.find(
            (submission) => String(submission.studentId) === String(user._id)
          ) || null
        : null;

    const submissionConfig =
      post.type === 'assignment'
        ? assignment
        : post.type === 'quiz'
          ? quiz
          : null;

    const submittedCount = postSubmissions.length;
    const gradedCount = postSubmissions.filter(
      (submission) => submission.status === 'graded'
    ).length;

    return {
      ...post,
      createdBy: authorProfileMap.get(String(post.createdBy)) || null,
      topicId: post.topicId
        ? {
            _id: post.topicId._id,
            name: post.topicId.name,
            isDefault: !!post.topicId.isDefault
          }
        : null,
      assignment,
      quiz,
      material,
      comments: commentMap.get(postId) || [],
      commentsCount: (commentMap.get(postId) || []).length,
      mySubmission,
      submissionSummary:
        post.type === 'assignment' || post.type === 'quiz'
          ? {
              totalStudents,
              submittedCount,
              gradedCount,
              pendingCount: Math.max(totalStudents - submittedCount, 0),
              myStatus: getSubmissionState({
                submission: mySubmission,
                dueDate: submissionConfig?.dueDate || null,
                allowLateSubmission:
                  submissionConfig?.allowLateSubmission ?? true
              })
            }
          : null
    };
  });
};

const getPostWithAccess = async ({ classroomId, postId, user }) => {
  const classroom = await ensureClassroomAccess({
    classroomId,
    user
  });

  if (!isValidObjectId(postId)) {
    throw new AppError('Invalid postId', 400);
  }

  const post = await ClassroomPost.findOne({
    _id: postId,
    classroomId
  })
    .populate('topicId', 'name isDefault')
    .lean();

  if (!post) {
    throw new AppError('Post not found', 404);
  }

  return { classroom, post };
};

const buildSubmissionRoster = async ({ classroom, post }) => {
  const submissionConfig =
    post.type === 'assignment'
      ? post.assignment
      : post.type === 'quiz'
        ? post.quiz
        : null;

  if (!submissionConfig) {
    return [];
  }

  const [students, submissions] = await Promise.all([
    getClassroomStudentRoster(classroom),
    Submission.find({ postId: post._id }).lean()
  ]);

  const submissionMap = new Map(
    submissions.map((submission) => [
      String(submission.studentId),
      serializeSubmission(submission)
    ])
  );

  return students.map((student) => {
    const submission = submissionMap.get(String(student.userId)) || null;

    return {
      student: {
        _id: student._id,
        userId: student.userId,
        firstName: student.firstName,
        lastName: student.lastName,
        registerNumber: student.registerNumber,
        rollNumber: student.rollNumber
      },
      submission,
      state: getSubmissionState({
        submission,
        dueDate: submissionConfig?.dueDate || null,
        allowLateSubmission: submissionConfig?.allowLateSubmission ?? true
      })
    };
  });
};

const normalizeQuizAnswers = (quizAnswers) => {
  const parsed = parseMaybeJson(quizAnswers, []);
  return Array.isArray(parsed) ? parsed : [];
};

const gradeQuizSubmission = (quiz, quizAnswers) => {
  const answerMap = new Map(
    (quizAnswers || []).map((answer) => [Number(answer.questionIndex), answer])
  );

  let marks = 0;

  quiz.questions.forEach((question, index) => {
    const answer = answerMap.get(index);
    if (!answer) return;

    if (question.questionType === 'short_answer') {
      const submittedText = String(answer.textAnswer || '')
        .trim()
        .toLowerCase();
      const expected = String(question.correctAnswers?.[0] || '')
        .trim()
        .toLowerCase();

      if (submittedText && submittedText === expected) {
        marks += Number(question.points || 0);
      }
      return;
    }

    const submittedAnswers = Array.isArray(answer.answers)
      ? answer.answers.map((item) => String(item).trim()).sort()
      : [];
    const expectedAnswers = (question.correctAnswers || [])
      .map((item) => String(item).trim())
      .sort();

    if (
      submittedAnswers.length === expectedAnswers.length &&
      submittedAnswers.every((value, idx) => value === expectedAnswers[idx])
    ) {
      marks += Number(question.points || 0);
    }
  });

  return marks;
};

const validateAssignmentSubmission = ({
  assignment,
  attachments,
  linkSubmission,
  textSubmission
}) => {
  const hasFiles = attachments.length > 0;
  const hasLink = !!linkSubmission;
  const hasText = !!stripHtml(textSubmission);

  if (assignment.submissionType === 'file' && !hasFiles) {
    throw new AppError('A file submission is required', 400);
  }

  if (assignment.submissionType === 'link' && !hasLink) {
    throw new AppError('A link submission is required', 400);
  }

  if (assignment.submissionType === 'text' && !hasText) {
    throw new AppError('A text submission is required', 400);
  }

  if (
    assignment.submissionType === 'any' &&
    !hasFiles &&
    !hasLink &&
    !hasText
  ) {
    throw new AppError('Add a file, link, or text before submitting', 400);
  }
};

const validateDueDateWindow = ({ dueDate, allowLateSubmission }) => {
  if (!dueDate) {
    return false;
  }

  const isLate = new Date(dueDate).getTime() < Date.now();

  if (isLate && !allowLateSubmission) {
    throw new AppError('Submissions are closed for this work item', 403);
  }

  return isLate;
};

export const createTopic = catchAsync(async (req, res, next) => {
  const { classroomId } = req.params;
  const { name } = req.body;

  await ensureClassroomAccess({
    classroomId,
    user: req.user,
    requireFaculty: true
  });

  if (!name || !String(name).trim()) {
    return next(new AppError('classroomId and name are required', 400));
  }

  const existing = await Topic.findOne({
    classroomId,
    name: String(name).trim()
  });

  if (existing) {
    return res.status(200).json({
      success: true,
      data: { topic: existing }
    });
  }

  const topic = await Topic.create({
    classroomId,
    name: String(name).trim(),
    isDefault: false
  });

  res.status(201).json({
    success: true,
    message: 'Topic created',
    data: { topic }
  });
});

export const getTopics = catchAsync(async (req, res, next) => {
  const { classroomId } = req.params;

  await ensureClassroomAccess({
    classroomId,
    user: req.user
  });

  const topics = await Topic.find({ classroomId })
    .select('_id name isDefault')
    .sort({ isDefault: -1, createdAt: 1 });

  res.status(200).json({
    success: true,
    data: { topics }
  });
});

export const updateTopic = catchAsync(async (req, res, next) => {
  const { classroomId, topicId } = req.params;
  const { name } = req.body;

  await ensureClassroomAccess({
    classroomId,
    user: req.user,
    requireFaculty: true
  });

  if (!topicId || !name || !String(name).trim()) {
    return next(new AppError('topicId and name are required', 400));
  }

  if (!isValidObjectId(topicId)) {
    return next(new AppError('Invalid topicId', 400));
  }

  const topic = await Topic.findOne({ _id: topicId, classroomId });

  if (!topic) {
    return next(new AppError('Topic not found', 404));
  }

  topic.name = String(name).trim();
  await topic.save();

  res.status(200).json({
    success: true,
    message: 'Topic updated',
    data: { topic }
  });
});

export const deleteTopic = catchAsync(async (req, res, next) => {
  const { classroomId, topicId } = req.params;

  await ensureClassroomAccess({
    classroomId,
    user: req.user,
    requireFaculty: true
  });

  if (!isValidObjectId(topicId)) {
    return next(new AppError('Invalid topicId', 400));
  }

  const topic = await Topic.findOne({ _id: topicId, classroomId });

  if (!topic) {
    return next(new AppError('Topic not found', 404));
  }

  if (topic.isDefault) {
    return next(new AppError('Cannot delete the default topic', 400));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const defaultTopic = await getOrCreateTopic(classroomId, session);

    await ClassroomPost.updateMany(
      { classroomId, topicId: topic._id },
      { topicId: defaultTopic._id },
      { session }
    );

    await Topic.findByIdAndDelete(topicId).session(session);

    await session.commitTransaction();
    res.status(200).json({
      success: true,
      message: 'Topic deleted and posts moved to default topic'
    });
  } catch (error) {
    await session.abortTransaction();
    return next(new AppError(error.message, 500));
  } finally {
    session.endSession();
  }
});

export const createPost = catchAsync(async (req, res, next) => {
  const { classroomId } = req.params;
  const {
    type,
    title,
    instructions,
    topicId,
    points,
    isUngraded,
    dueDate,
    submissionType,
    allowLateSubmission,
    quizData,
    attachments
  } = req.body;

  await ensureClassroomAccess({
    classroomId,
    user: req.user,
    requireFaculty: true
  });

  if (!classroomId || !type) {
    return next(new AppError('classroomId and type are required', 400));
  }

  const allowedTypes = ['announcement', 'assignment', 'quiz', 'material'];
  if (!allowedTypes.includes(type)) {
    return next(new AppError('Invalid post type', 400));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let finalTopic;
    if (!topicId || !isValidObjectId(topicId)) {
      finalTopic = await getOrCreateTopic(classroomId, session);
    } else {
      finalTopic =
        (await Topic.findOne({ _id: topicId, classroomId }).session(session)) ||
        (await getOrCreateTopic(classroomId, session));
    }

    const parsedAttachments = normalizeLinkedAttachments(
      parseMaybeJson(attachments, [])
    );
    const uploadedAttachments = req.file
      ? normalizeUploadedAttachments([req.file])
      : [];

    const [post] = await ClassroomPost.create(
      [
        {
          classroomId,
          createdBy: req.user._id,
          createdByRole: normalizeCreatorRole(req.user.role),
          type,
          title: title || '',
          instructions: instructions || '',
          topicId: finalTopic._id,
          attachments: [...uploadedAttachments, ...parsedAttachments]
        }
      ],
      { session }
    );

    if (type === 'assignment') {
      await Assignment.create(
        [
          {
            postId: post._id,
            points:
              isUngraded === 'true' || isUngraded === true
                ? null
                : Number(points || 0),
            isUngraded: isUngraded === 'true' || isUngraded === true,
            dueDate: dueDate || null,
            submissionType: submissionType || 'any',
            allowLateSubmission:
              allowLateSubmission === undefined
                ? true
                : allowLateSubmission === 'true' || allowLateSubmission === true
          }
        ],
        { session }
      );
    }

    if (type === 'quiz') {
      const normalizedQuizData = parseMaybeJson(quizData, {});
      if (
        !normalizedQuizData?.questions ||
        !Array.isArray(normalizedQuizData.questions)
      ) {
        throw new AppError('Quiz data and questions are required', 400);
      }

      await Quiz.create(
        [
          {
            postId: post._id,
            dueDate: dueDate || null,
            isAutoGraded:
              normalizedQuizData.isAutoGraded === undefined
                ? true
                : !!normalizedQuizData.isAutoGraded,
            questions: normalizedQuizData.questions,
            allowLateSubmission:
              allowLateSubmission === undefined
                ? true
                : allowLateSubmission === 'true' || allowLateSubmission === true
          }
        ],
        { session }
      );
    }

    if (type === 'material') {
      await Material.create([{ postId: post._id }], { session });
    }

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post }
    });
  } catch (error) {
    await session.abortTransaction();
    return next(error);
  } finally {
    session.endSession();
  }
});

export const updatePost = catchAsync(async (req, res, next) => {
  const { classroomId, postId } = req.params;

  await ensureClassroomAccess({
    classroomId,
    user: req.user,
    requireFaculty: true
  });

  const post = await ClassroomPost.findOne({
    _id: postId,
    classroomId
  });

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  const isOwner = String(post.createdBy) === String(req.user._id);
  const isPrivileged = req.user.role === 'ADMIN' || req.user.role === 'HOD';

  if (!isOwner && !isPrivileged) {
    return next(new AppError('Not authorized to update this post', 403));
  }

  const updates = { ...req.body };
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (Object.prototype.hasOwnProperty.call(updates, 'topicId')) {
      const nextTopic =
        (isValidObjectId(updates.topicId)
          ? await Topic.findOne({
              _id: updates.topicId,
              classroomId: post.classroomId
            }).session(session)
          : null) || (await getOrCreateTopic(post.classroomId, session));

      post.topicId = nextTopic._id;
    }

    const linkedAttachments = normalizeLinkedAttachments(
      parseMaybeJson(updates.attachments, post.attachments || [])
    );
    const uploadedAttachments = req.file
      ? normalizeUploadedAttachments([req.file])
      : [];

    if (updates.title !== undefined) post.title = updates.title;
    if (updates.instructions !== undefined) post.instructions = updates.instructions;
    if (updates.attachments !== undefined || req.file) {
      post.attachments = [...linkedAttachments, ...uploadedAttachments];
    }

    await post.save({ session });

    if (post.type === 'assignment') {
      const assignment = await Assignment.findOne({ postId }).session(session);
      if (assignment) {
        if (updates.points !== undefined) {
          assignment.points =
            updates.isUngraded === 'true' || updates.isUngraded === true
              ? null
              : Number(updates.points || 0);
        }
        if (updates.isUngraded !== undefined) {
          assignment.isUngraded =
            updates.isUngraded === 'true' || updates.isUngraded === true;
          if (assignment.isUngraded) {
            assignment.points = null;
          }
        }
        if (updates.dueDate !== undefined) assignment.dueDate = updates.dueDate || null;
        if (updates.submissionType !== undefined) {
          assignment.submissionType = updates.submissionType || 'any';
        }
        if (updates.allowLateSubmission !== undefined) {
          assignment.allowLateSubmission =
            updates.allowLateSubmission === 'true' ||
            updates.allowLateSubmission === true;
        }

        await assignment.save({ session });
      }
    }

    if (post.type === 'quiz') {
      const quiz = await Quiz.findOne({ postId }).session(session);
      if (quiz) {
        const normalizedQuizData =
          parseMaybeJson(updates.quizData, null) ||
          (Array.isArray(updates.questions)
            ? { questions: updates.questions }
            : null);

        if (normalizedQuizData?.questions) {
          quiz.questions = normalizedQuizData.questions;
        }

        if (normalizedQuizData?.isAutoGraded !== undefined) {
          quiz.isAutoGraded = !!normalizedQuizData.isAutoGraded;
        }

        if (updates.isAutoGraded !== undefined) {
          quiz.isAutoGraded =
            updates.isAutoGraded === 'true' || updates.isAutoGraded === true;
        }

        if (updates.dueDate !== undefined) quiz.dueDate = updates.dueDate || null;
        if (updates.allowLateSubmission !== undefined) {
          quiz.allowLateSubmission =
            updates.allowLateSubmission === 'true' ||
            updates.allowLateSubmission === true;
        }

        await quiz.save({ session });
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: { post }
    });
  } catch (error) {
    await session.abortTransaction();
    return next(error);
  } finally {
    session.endSession();
  }
});

export const deletePost = catchAsync(async (req, res, next) => {
  const { classroomId, postId } = req.params;

  await ensureClassroomAccess({
    classroomId,
    user: req.user,
    requireFaculty: true
  });

  if (!isValidObjectId(postId)) {
    return next(new AppError('Invalid postId', 400));
  }

  const post = await ClassroomPost.findOne({ _id: postId, classroomId });

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (post.type === 'assignment') {
      await Assignment.findOneAndDelete({ postId: post._id }).session(session);
    }

    if (post.type === 'quiz') {
      await Quiz.findOneAndDelete({ postId: post._id }).session(session);
    }

    if (post.type === 'material') {
      await Material.findOneAndDelete({ postId: post._id }).session(session);
    }

    await Promise.all([
      Comment.deleteMany({ postId: post._id }).session(session),
      Submission.deleteMany({ postId: post._id }).session(session),
      ClassroomPost.findByIdAndDelete(postId).session(session)
    ]);

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Post (${post.type}) and all associated data deleted successfully`
    });
  } catch (error) {
    await session.abortTransaction();
    return next(new AppError(error.message, 500));
  } finally {
    session.endSession();
  }
});

export const getStream = catchAsync(async (req, res, next) => {
  const { classroomId } = req.params;

  const classroom = await ensureClassroomAccess({
    classroomId,
    user: req.user
  });

  const posts = await ClassroomPost.find({ classroomId })
    .populate('topicId', 'name isDefault')
    .sort({ createdAt: -1 })
    .lean();

  const stream = await hydratePosts({
    classroom,
    posts,
    user: req.user
  });

  res.status(200).json({
    success: true,
    data: { stream }
  });
});

export const getClasswork = catchAsync(async (req, res, next) => {
  const { classroomId } = req.params;

  const classroom = await ensureClassroomAccess({
    classroomId,
    user: req.user
  });

  const [topics, posts] = await Promise.all([
    Topic.find({ classroomId })
      .select('_id name isDefault')
      .sort({ isDefault: -1, createdAt: 1 })
      .lean(),
    ClassroomPost.find({
      classroomId,
      type: { $ne: 'announcement' }
    })
      .populate('topicId', 'name isDefault')
      .sort({ createdAt: -1 })
      .lean()
  ]);

  const hydratedPosts = await hydratePosts({
    classroom,
    posts,
    user: req.user
  });

  const groupedPosts = new Map();
  hydratedPosts.forEach((post) => {
    const topicKey = post.topicId?._id ? String(post.topicId._id) : null;
    if (!groupedPosts.has(topicKey)) {
      groupedPosts.set(topicKey, []);
    }
    groupedPosts.get(topicKey).push(post);
  });

  const classwork = topics.map((topic) => ({
    _id: topic._id,
    name: topic.name,
    isDefault: !!topic.isDefault,
    posts: groupedPosts.get(String(topic._id)) || []
  }));

  res.status(200).json({
    success: true,
    data: { classwork }
  });
});

export const getPostDetails = catchAsync(async (req, res, next) => {
  const { classroomId, postId } = req.params;

  const { classroom, post } = await getPostWithAccess({
    classroomId,
    postId,
    user: req.user
  });

  const [hydratedPost] = await hydratePosts({
    classroom,
    posts: [post],
    user: req.user
  });

  let submissionRoster = [];
  if (
    hydratedPost &&
    facultyRoles.has(req.user.role) &&
    (hydratedPost.type === 'assignment' || hydratedPost.type === 'quiz')
  ) {
    submissionRoster = await buildSubmissionRoster({
      classroom,
      post: hydratedPost
    });
  }

  res.status(200).json({
    success: true,
    data: {
      classroom: await getPopulatedClassroom(classroomId),
      post: hydratedPost,
      submissionRoster
    }
  });
});

export const submitPostSubmission = catchAsync(async (req, res, next) => {
  const { classroomId, postId } = req.params;

  if (req.user.role !== 'STUDENT') {
    return next(new AppError('Only students can submit work', 403));
  }

  const { post } = await getPostWithAccess({
    classroomId,
    postId,
    user: req.user
  });

  const existingSubmission = await Submission.findOne({
    postId,
    studentId: req.user._id
  });

  if (existingSubmission?.submittedAt) {
    return next(
      new AppError(
        'Submission already completed. Resubmission is not allowed.',
        409
      )
    );
  }

  const linkedAttachments = normalizeLinkedAttachments(
    parseMaybeJson(req.body.attachments, existingSubmission?.attachments || [])
  );
  const uploadedAttachments = normalizeUploadedAttachments(req.files || []);
  const attachments = [...linkedAttachments, ...uploadedAttachments];
  const textSubmission = req.body.textSubmission || '';
  const linkSubmission = req.body.linkSubmission || '';

  if (post.type === 'assignment') {
    const assignment = await Assignment.findOne({ postId });
    if (!assignment) {
      return next(new AppError('Assignment not found', 404));
    }

    const isLate = validateDueDateWindow({
      dueDate: assignment.dueDate,
      allowLateSubmission: assignment.allowLateSubmission
    });

    validateAssignmentSubmission({
      assignment,
      attachments,
      linkSubmission,
      textSubmission
    });

    const submission =
      existingSubmission ||
      new Submission({
        postId,
        assignmentId: assignment._id,
        submissionType: 'assignment',
        studentId: req.user._id
      });

    submission.assignmentId = assignment._id;
    submission.quizId = null;
    submission.submissionType = 'assignment';
    submission.attachments = attachments;
    submission.textSubmission = textSubmission;
    submission.linkSubmission = linkSubmission;
    submission.quizAnswers = [];
    submission.isLate = isLate;
    submission.submittedAt = new Date();
    submission.status = 'submitted';
    submission.marks =
      existingSubmission?.status === 'graded' ? existingSubmission.marks : null;

    await submission.save();

    return res.status(200).json({
      success: true,
      message: 'Assignment submitted successfully',
      data: { submission: serializeSubmission(submission.toObject()) }
    });
  }

  if (post.type === 'quiz') {
    const quiz = await Quiz.findOne({ postId });
    if (!quiz) {
      return next(new AppError('Quiz not found', 404));
    }

    const quizAnswers = normalizeQuizAnswers(req.body.quizAnswers);
    if (!quizAnswers.length) {
      return next(new AppError('Quiz answers are required', 400));
    }

    const isLate = validateDueDateWindow({
      dueDate: quiz.dueDate,
      allowLateSubmission: quiz.allowLateSubmission
    });

    const marks = quiz.isAutoGraded
      ? gradeQuizSubmission(quiz, quizAnswers)
      : null;

    const submission =
      existingSubmission ||
      new Submission({
        postId,
        quizId: quiz._id,
        submissionType: 'quiz',
        studentId: req.user._id
      });

    submission.assignmentId = null;
    submission.quizId = quiz._id;
    submission.submissionType = 'quiz';
    submission.attachments = [];
    submission.textSubmission = '';
    submission.linkSubmission = '';
    submission.quizAnswers = quizAnswers;
    submission.isLate = isLate;
    submission.submittedAt = new Date();
    submission.status = quiz.isAutoGraded ? 'graded' : 'submitted';
    submission.marks = marks;

    await submission.save();

    return res.status(200).json({
      success: true,
      message: 'Quiz submitted successfully',
      data: { submission: serializeSubmission(submission.toObject()) }
    });
  }

  return next(new AppError('This post does not accept submissions', 400));
});

export const getPostSubmissions = catchAsync(async (req, res, next) => {
  const { classroomId, postId } = req.params;

  await ensureClassroomAccess({
    classroomId,
    user: req.user,
    requireFaculty: true
  });

  const { classroom, post } = await getPostWithAccess({
    classroomId,
    postId,
    user: req.user
  });

  const [hydratedPost] = await hydratePosts({
    classroom,
    posts: [post],
    user: req.user
  });

  const submissionRoster = await buildSubmissionRoster({
    classroom,
    post: hydratedPost
  });

  res.status(200).json({
    success: true,
    data: {
      post: hydratedPost,
      submissionRoster
    }
  });
});

export const addComment = catchAsync(async (req, res, next) => {
  const { classroomId, postId } = req.params;
  const { message } = req.body;

  await ensureClassroomAccess({
    classroomId,
    user: req.user
  });

  if (!message || !stripHtml(message)) {
    return next(new AppError('Message is required', 400));
  }

  if (!isValidObjectId(postId)) {
    return next(new AppError('Invalid postId', 400));
  }

  const post = await ClassroomPost.findOne({
    _id: postId,
    classroomId
  });

  if (!post) {
    return next(new AppError('Post not found in this classroom', 404));
  }

  const comment = await Comment.create({
    postId,
    userId: req.user._id,
    message: String(message).trim()
  });

  const authorMap = await getAuthorProfiles([req.user._id]);

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: {
      comment: {
        _id: comment._id,
        message: comment.message,
        createdAt: comment.createdAt,
        user: authorMap.get(String(req.user._id)) || null
      }
    }
  });
});

export const deleteComment = catchAsync(async (req, res, next) => {
  const { classroomId, commentId } = req.params;

  await ensureClassroomAccess({
    classroomId,
    user: req.user
  });

  if (!isValidObjectId(commentId)) {
    return next(new AppError('Invalid commentId', 400));
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  const isOwner = String(comment.userId) === String(req.user._id);
  const canManage = isOwner || facultyRoles.has(req.user.role);

  if (!canManage) {
    return next(new AppError('Not authorized to delete this comment', 403));
  }

  await Comment.findByIdAndDelete(commentId);

  res.status(200).json({
    success: true,
    message: 'Comment deleted successfully'
  });
});
