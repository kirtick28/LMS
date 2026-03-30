import mongoose from 'mongoose';
import ClassroomPost from '../models/ClassroomPost.js';
import Assignment from '../models/Assignment.js';
import Comment from '../models/Comment.js';
import Material from '../models/Material.js';
import Topic from '../models/Topic.js';
import Quiz from '../models/Quiz.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

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

// ================= TOPIC =================
export const createTopic = catchAsync(async (req, res, next) => {
  const { classroomId } = req.params;
  const { name } = req.body;

  if (!classroomId || !name) {
    return next(new AppError('classroomId and name are required', 400));
  }

  if (!mongoose.Types.ObjectId.isValid(classroomId)) {
    return next(new AppError('Invalid classroomId', 400));
  }

  const existing = await Topic.findOne({
    classroomId,
    name: name.trim()
  });

  if (existing) {
    return res.status(200).json({
      success: true,
      data: { topic: existing }
    });
  }

  const topic = await Topic.create({
    classroomId,
    name: name.trim(),
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

  if (!mongoose.Types.ObjectId.isValid(classroomId)) {
    return next(new AppError('Invalid classroomId', 400));
  }

  const topics = await Topic.find({ classroomId })
    .select('_id name isDefault')
    .sort({ isDefault: -1, createdAt: 1 }); // default first

  res.status(200).json({
    success: true,
    data: { topics }
  });
});

export const updateTopic = catchAsync(async (req, res, next) => {
  const { topicId } = req.params;
  const { name } = req.body;

  if (!topicId || !name) {
    return next(new AppError('topicId and name are required', 400));
  }

  if (!mongoose.Types.ObjectId.isValid(topicId)) {
    return next(new AppError('Invalid topicId', 400));
  }

  const topic = await Topic.findById(topicId);

  if (!topic) {
    return next(new AppError('Topic not found', 404));
  }

  topic.name = name.trim();

  await topic.save();

  res.status(200).json({
    success: true,
    message: 'Topic updated',
    data: { topic }
  });
});

export const deleteTopic = catchAsync(async (req, res, next) => {
  const { classroomId, topicId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(topicId)) {
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
    // 1. Get or create the default topic for migration
    const defaultTopic = await getOrCreateTopic(classroomId, session);

    // 2. Move all posts from the deleting topic to the default topic
    await ClassroomPost.updateMany(
      { classroomId, topicId: topic._id },
      { topicId: defaultTopic._id },
      { session }
    );

    // 3. Delete the topic
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

// ================= POST =================
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
    quizData,
    options
  } = req.body;

  const user = req.user;

  if (!classroomId || !type) {
    return next(new AppError('classroomId and type are required', 400));
  }

  if (!mongoose.Types.ObjectId.isValid(classroomId)) {
    return next(new AppError('Invalid classroomId', 400));
  }

  const allowedTypes = ['announcement', 'assignment', 'quiz', 'material'];

  if (!allowedTypes.includes(type)) {
    return next(new AppError('Invalid post type', 400));
  }

  if (user.role === 'student' && type !== 'announcement') {
    return next(new AppError('Students can only create announcements', 403));
  }

  // ================= ATTACHMENTS =================
  let attachments = [];
  if (req.file) {
    attachments.push({
      fileName: req.file.originalname,
      fileUrl: `/pdf/${req.file.filename}`,
      fileType: req.file.mimetype
    });
  }

  if (req.body.attachments) {
    let parsedAttachments = req.body.attachments;
    if (typeof parsedAttachments === 'string') {
      parsedAttachments = JSON.parse(parsedAttachments);
    }
    if (Array.isArray(parsedAttachments)) {
      parsedAttachments.forEach((att) => {
        if (att.fileUrl) {
          attachments.push({
            fileName: att.fileName || 'link',
            fileUrl: att.fileUrl,
            fileType: att.fileType || 'link'
          });
        }
      });
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ================= TOPIC =================
    let topic;
    if (!topicId) {
      topic = await getOrCreateTopic(classroomId, session);
    } else {
      topic = await Topic.findOne({ _id: topicId, classroomId }).session(
        session
      );
      if (!topic) {
        topic = await getOrCreateTopic(classroomId, session);
      }
    }

    // ================= BASE POST =================
    const post = await ClassroomPost.create(
      [
        {
          classroomId,
          createdBy: user._id,
          createdByRole: user.role,
          type,
          title,
          instructions,
          topicId: topic._id,
          attachments
        }
      ],
      { session }
    );

    const postId = post[0]._id;

    // ================= ASSIGNMENT =================
    if (type === 'assignment') {
      await Assignment.create(
        [
          {
            postId,
            points: isUngraded ? null : Number(points),
            isUngraded: !!isUngraded,
            dueDate,
            submissionType
          }
        ],
        { session }
      );
    }

    // ================= UPDATED QUIZ LOGIC =================
    if (type === 'quiz') {
      const qData = JSON.parse(quizData);
      if (!qData || !qData.questions) {
        throw new AppError(
          'Quiz data and questions are required for quiz type',
          400
        );
      }

      await Quiz.create(
        [
          {
            postId,
            isAutoGraded:
              qData.isAutoGraded !== undefined ? qData.isAutoGraded : true,
            questions: qData.questions,
            dueDate
            /**
             * Note: The Quiz model 'pre-save' hook will automatically
             * calculate totalMarks based on the points in each question.
             */
          }
        ],
        { session }
      );
    }

    // ================= MATERIAL =================
    if (type === 'material') {
      await Material.create([{ postId }], { session });
    }

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post: post[0] }
    });
  } catch (err) {
    await session.abortTransaction();
    return next(err);
  } finally {
    session.endSession();
  }
});

export const updatePost = catchAsync(async (req, res, next) => {
  const { postId } = req.params;
  let updates = { ...req.body };

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return next(new AppError('Invalid postId', 400));
  }

  const post = await ClassroomPost.findById(postId);

  if (!post || post.isDeleted) {
    return next(new AppError('Post not found', 404));
  }

  if (post.createdBy.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to update this post', 403));
  }

  // ================= ATTACHMENTS =================
  if (updates.attachments) {
    if (typeof updates.attachments === 'string') {
      try {
        updates.attachments = JSON.parse(updates.attachments);
      } catch (err) {
        return next(new AppError('Invalid attachments format', 400));
      }
    }
    if (!Array.isArray(updates.attachments)) {
      updates.attachments = [];
    }
  }

  if (req.file) {
    if (!updates.attachments) updates.attachments = [];
    updates.attachments.push({
      fileName: req.file.originalname,
      fileUrl: `/pdf/${req.file.filename}`,
      fileType: req.file.mimetype
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ================= TOPIC UPDATE =================
    if (updates.topicId) {
      let topic;
      if (!mongoose.Types.ObjectId.isValid(updates.topicId)) {
        topic = await getOrCreateTopic(post.classroomId, session);
      } else {
        topic = await Topic.findOne({
          _id: updates.topicId,
          classroomId: post.classroomId
        }).session(session);

        if (!topic) {
          topic = await getOrCreateTopic(post.classroomId, session);
        }
      }
      post.topicId = topic._id;
    }

    // ================= BASE POST UPDATE =================
    const baseFields = ['title', 'instructions', 'attachments'];
    baseFields.forEach((key) => {
      if (updates[key] !== undefined) {
        post[key] = updates[key];
      }
    });

    await post.save({ session });

    // ================= TYPE-SPECIFIC UPDATE =================
    const type = post.type;

    if (type === 'assignment') {
      const assignment = await Assignment.findOne({ postId }).session(session);
      if (assignment) {
        if ('points' in updates)
          assignment.points = updates.isUngraded
            ? null
            : Number(updates.points);
        if ('isUngraded' in updates) assignment.isUngraded = updates.isUngraded;
        if ('dueDate' in updates) assignment.dueDate = updates.dueDate;
        if ('submissionType' in updates)
          assignment.submissionType = updates.submissionType;

        await assignment.save({ session });
      }
    }

    // UPDATED QUIZ LOGIC
    if (type === 'quiz') {
      const quiz = await Quiz.findOne({ postId }).session(session);
      if (quiz) {
        if (updates.isAutoGraded !== undefined) {
          quiz.isAutoGraded = updates.isAutoGraded;
        }

        if (updates.questions && Array.isArray(updates.questions)) {
          quiz.questions = updates.questions;
        }

        if (updates.dueDate !== undefined) {
          quiz.dueDate = updates.dueDate;
        }

        if (updates.allowLateSubmission !== undefined) {
          quiz.allowLateSubmission = updates.allowLateSubmission;
        }

        await quiz.save({ session });
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: post
    });
  } catch (err) {
    await session.abortTransaction();
    return next(err);
  } finally {
    session.endSession();
  }
});

export const deletePost = catchAsync(async (req, res, next) => {
  const { classroomId, postId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return next(new AppError('Invalid postId', 400));
  }

  // Find the post and ensure it belongs to the specified classroom
  const post = await ClassroomPost.findOne({ _id: postId, classroomId });

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Delete associated child documents based on the post type
    switch (post.type) {
      case 'assignment':
        await Assignment.findOneAndDelete({ postId: post._id }).session(
          session
        );
        break;
      case 'quiz':
        await Quiz.findOneAndDelete({ postId: post._id }).session(session);
        break;
      case 'material':
        await Material.findOneAndDelete({ postId: post._id }).session(session);
        break;
      default:
        // 'announcement' has no extra child document to delete
        break;
    }

    // 2. Delete all comments associated with this post
    await Comment.deleteMany({ postId: post._id }).session(session);

    /**
     * Note: If you eventually implement a 'Submission' model for
     * assignments or quizzes, you should also add:
     * await Submission.deleteMany({ postId: post._id }).session(session);
     */

    // 3. Delete the main post
    await ClassroomPost.findByIdAndDelete(postId).session(session);

    await session.commitTransaction();
    res.status(200).json({
      success: true,
      message: `Post (${post.type}) and all associated child data/comments deleted successfully`
    });
  } catch (error) {
    await session.abortTransaction();
    return next(new AppError(error.message, 500));
  } finally {
    session.endSession();
  }
});
// ================= STREAM =================
export const getStream = catchAsync(async (req, res, next) => {
  const { classroomId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(classroomId)) {
    return next(new AppError('Invalid classroomId', 400));
  }

  const stream = await ClassroomPost.aggregate([
    {
      $match: {
        classroomId: new mongoose.Types.ObjectId(classroomId)
      }
    },

    // ================= USER =================
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },

    // ================= FACULTY =================
    {
      $lookup: {
        from: 'faculties',
        localField: 'user._id',
        foreignField: 'userId',
        as: 'faculty'
      }
    },

    // ================= STUDENT =================
    {
      $lookup: {
        from: 'students',
        localField: 'user._id',
        foreignField: 'userId',
        as: 'student'
      }
    },

    // ================= MERGE =================
    {
      $addFields: {
        createdByUser: {
          $cond: [
            { $eq: ['$createdByRole', 'FACULTY'] },
            { $arrayElemAt: ['$faculty', 0] },
            { $arrayElemAt: ['$student', 0] }
          ]
        }
      }
    },

    // ================= ASSIGNMENT =================
    {
      $lookup: {
        from: 'assignments',
        localField: '_id',
        foreignField: 'postId',
        as: 'assignment'
      }
    },
    { $unwind: { path: '$assignment', preserveNullAndEmptyArrays: true } },

    // ================= QUIZ =================
    {
      $lookup: {
        from: 'quizzes',
        localField: '_id',
        foreignField: 'postId',
        as: 'quiz'
      }
    },
    { $unwind: { path: '$quiz', preserveNullAndEmptyArrays: true } },

    // ================= MATERIAL =================
    {
      $lookup: {
        from: 'materials',
        localField: '_id',
        foreignField: 'postId',
        as: 'material'
      }
    },
    { $unwind: { path: '$material', preserveNullAndEmptyArrays: true } },

    // ================= COMMENTS =================
    {
      $lookup: {
        from: 'comments',
        let: { postId: '$_id', type: '$type' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$postId', '$$postId'] },
                  { $eq: ['$$type', 'announcement'] }
                ]
              }
            }
          },
          { $sort: { createdAt: -1 } },

          // USER
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: '$user' },

          // FACULTY
          {
            $lookup: {
              from: 'faculties',
              localField: 'user._id',
              foreignField: 'userId',
              as: 'faculty'
            }
          },

          // STUDENT
          {
            $lookup: {
              from: 'students',
              localField: 'user._id',
              foreignField: 'userId',
              as: 'student'
            }
          },

          {
            $addFields: {
              finalUser: {
                $cond: [
                  { $gt: [{ $size: '$faculty' }, 0] },
                  { $arrayElemAt: ['$faculty', 0] },
                  { $arrayElemAt: ['$student', 0] }
                ]
              }
            }
          },

          {
            $project: {
              _id: 1,
              message: 1,
              createdAt: 1,
              user: {
                _id: '$finalUser._id',
                firstName: '$finalUser.firstName',
                lastName: '$finalUser.lastName'
              }
            }
          }
        ],
        as: 'comments'
      }
    },

    // ================= COMMENTS COUNT =================
    {
      $lookup: {
        from: 'comments',
        let: { postId: '$_id', type: '$type' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$postId', '$$postId'] },
                  { $eq: ['$$type', 'announcement'] }
                ]
              }
            }
          },
          { $count: 'count' }
        ],
        as: 'commentsCount'
      }
    },

    {
      $addFields: {
        comments: {
          $cond: [{ $eq: ['$type', 'announcement'] }, '$comments', []]
        },
        commentsCount: {
          $cond: [
            { $eq: ['$type', 'announcement'] },
            { $ifNull: [{ $arrayElemAt: ['$commentsCount.count', 0] }, 0] },
            0
          ]
        }
      }
    },

    {
      $project: {
        _id: 1,
        type: 1,
        title: 1,
        instructions: 1,
        attachments: 1,
        createdAt: 1,
        createdByRole: 1,

        createdBy: {
          _id: '$createdByUser._id',
          firstName: '$createdByUser.firstName',
          lastName: '$createdByUser.lastName'
        },

        assignment: 1,
        quiz: 1,
        material: 1,

        comments: 1,
        commentsCount: 1
      }
    },

    { $sort: { createdAt: -1 } }
  ]);

  res.json({
    success: true,
    data: { stream }
  });
});

// ================= CLASSWORK =================
export const getClasswork = catchAsync(async (req, res, next) => {
  const { classroomId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(classroomId)) {
    return next(new AppError('Invalid classroomId', 400));
  }

  const classwork = await Topic.aggregate([
    {
      $match: {
        classroomId: new mongoose.Types.ObjectId(classroomId)
      }
    },

    {
      $lookup: {
        from: 'classroomposts',
        let: { topicId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$topicId', '$$topicId'] },
                  { $ne: ['$type', 'announcement'] }
                ]
              }
            }
          },

          {
            $lookup: {
              from: 'users',
              localField: 'createdBy',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },

          {
            $lookup: {
              from: 'faculties',
              localField: 'user._id',
              foreignField: 'userId',
              as: 'faculty'
            }
          },

          // ================= STUDENT =================
          {
            $lookup: {
              from: 'students',
              localField: 'user._id',
              foreignField: 'userId',
              as: 'student'
            }
          },

          {
            $addFields: {
              createdByUser: {
                $cond: [
                  { $eq: ['$createdByRole', 'FACULTY'] },
                  { $arrayElemAt: ['$faculty', 0] },
                  { $arrayElemAt: ['$student', 0] }
                ]
              }
            }
          },

          {
            $lookup: {
              from: 'assignments',
              localField: '_id',
              foreignField: 'postId',
              as: 'assignment'
            }
          },
          {
            $unwind: {
              path: '$assignment',
              preserveNullAndEmptyArrays: true
            }
          },

          {
            $lookup: {
              from: 'quizzes',
              localField: '_id',
              foreignField: 'postId',
              as: 'quiz'
            }
          },
          {
            $unwind: {
              path: '$quiz',
              preserveNullAndEmptyArrays: true
            }
          },

          {
            $lookup: {
              from: 'materials',
              localField: '_id',
              foreignField: 'postId',
              as: 'material'
            }
          },
          {
            $unwind: {
              path: '$material',
              preserveNullAndEmptyArrays: true
            }
          },

          {
            $project: {
              _id: 1,
              type: 1,
              title: 1,
              instructions: 1,
              attachments: 1,
              createdAt: 1,
              createdByRole: 1,

              createdBy: {
                _id: '$createdByUser._id',
                firstName: '$createdByUser.firstName',
                lastName: '$createdByUser.lastName'
              },

              assignment: 1,
              quiz: 1,
              material: 1
            }
          },

          { $sort: { createdAt: -1 } }
        ],
        as: 'posts'
      }
    },

    {
      $project: {
        _id: 1,
        name: 1,
        isDefault: 1,
        posts: 1
      }
    }
  ]);

  res.json({
    success: true,
    data: { classwork }
  });
});

// ================= COMMENT =================
export const addComment = catchAsync(async (req, res, next) => {
  const { classroomId, postId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return next(new AppError('Message is required', 400));
  }

  if (
    !mongoose.Types.ObjectId.isValid(classroomId) ||
    !mongoose.Types.ObjectId.isValid(postId)
  ) {
    return next(new AppError('Invalid ids', 400));
  }

  const post = await ClassroomPost.findOne({
    _id: postId,
    classroomId
  });

  if (!post) {
    return next(new AppError('Post not found in this classroom', 404));
  }

  if (post.allowComments === false) {
    return next(new AppError('Comments are disabled for this post', 403));
  }

  const comment = await Comment.create({
    postId,
    userId: req.user._id,
    message: message.trim()
  });

  const populatedComment = await Comment.findById(comment._id)
    .populate('userId', 'firstName lastName')
    .lean();

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: {
      comment: {
        _id: populatedComment._id,
        message: populatedComment.message,
        createdAt: populatedComment.createdAt,
        user: populatedComment.userId
      }
    }
  });
});

export const deleteComment = catchAsync(async (req, res, next) => {
  const { commentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return next(new AppError('Invalid commentId', 400));
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  const isOwner = comment.userId.toString() === req.user._id.toString();
  const isFaculty = req.user.role === 'FACULTY';

  if (!isOwner && !isFaculty) {
    return next(new AppError('Not authorized to delete this comment', 403));
  }

  await Comment.findByIdAndDelete(commentId);

  res.status(200).json({
    success: true,
    message: 'Comment deleted successfully'
  });
});
