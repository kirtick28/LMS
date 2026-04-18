import mongoose from 'mongoose';
import crypto from 'crypto';
import { sendEmail } from '../utils/sendEmail.js';
import User from '../models/User.js';
import Classroom from '../models/Classroom.js';
import ClassroomMember from '../models/ClassroomMember.js';
import ClassroomInvitation from '../models/ClassroomInvitation.js';
import Faculty from '../models/Faculty.js';
import Student from '../models/Student.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import {
  ensureClassroomAccess,
  getClassroomStudentRoster
} from '../utils/classroomAccess.js';

const generateHTMLContent = (classroomName, inviteUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            .email-container {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333333;
                max-width: 600px;
                margin: 0 auto;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                overflow: hidden;
            }
            .header {
                background-color: #08384f;
                color: #ffffff;
                padding: 30px;
                text-align: center;
            }
            .content {
                padding: 30px;
                background-color: #ffffff;
            }
            .footer {
                background-color: #f9f9f9;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #777777;
            }
            .button {
                display: inline-block;
                padding: 14px 30px;
                background-color: #08384f;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                margin-top: 20px;
            }
            .expiry-note {
                margin-top: 25px;
                padding: 15px;
                background-color: #fff4f4;
                border-left: 4px solid #d9534f;
                color: #b94a48;
                font-size: 14px;
            }
            .highlight {
                color: #08384f;
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1 style="margin:0; font-size: 24px;">Classroom Invitation</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>You have been officially invited to join the classroom: <br>
                  <span class="highlight" style="font-size: 18px;">${classroomName || 'New Class'}</span>
                </p>
                
                <p>To access your course materials, assignments, and announcements, please click the button below to join the class.</p>
                
                <div style="text-align: center;">
                    <a href="${inviteUrl}" class="button">Join Classroom</a>
                </div>

                <div class="expiry-note">
                    <strong>Important:</strong> This invitation link is valid for the next <strong>24 hours</strong> only. Please ensure you join before the link expires.
                </div>

                <p style="margin-top: 30px;">If you have any issues joining, please contact your administrator.</p>
                <p>Best regards,<br>Academic Team</p>
            </div>
            <div class="footer">
                <p>&copy; 2026 SECE Classroom Portal. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

export const getClassroomMembers = catchAsync(async (req, res, next) => {
  const { classroomId } = req.params;
  const classroom = await ensureClassroomAccess({
    classroomId,
    user: req.user
  });

  const members = await ClassroomMember.find({
    classroomId,
    status: 'active'
  }).lean();

  const facultyUserIds = members
    .filter((m) => m.role === 'FACULTY')
    .map((m) => m.userId);

  const [faculties, students] = await Promise.all([
    facultyUserIds.length
      ? Faculty.find({ userId: { $in: facultyUserIds } })
          .select(
            'firstName lastName employeeId designation profileImage departmentId userId'
          )
          .populate({ path: 'departmentId', select: 'name code' })
          .sort({ firstName: 1, lastName: 1 })
          .lean()
      : [],
    getClassroomStudentRoster(classroom)
  ]);

  res.status(200).json({
    success: true,
    message: 'Classroom members retrieved successfully',
    data: {
      faculties,
      students
    }
  });
});

export const getEligibleMembersForInvite = catchAsync(
  async (req, res, next) => {
    const { classroomId, type } = req.params;

    const classroom = await ensureClassroomAccess({
      classroomId,
      user: req.user,
      requireFaculty: true
    });

    const existingMembers = await ClassroomMember.find({
      classroomId,
      status: 'active'
    }).select('userId');

    const pendingInvites = await ClassroomInvitation.find({
      classroomId,
      status: 'pending'
    }).select('invitedUserId');

    const excludedUserIds = [
      ...existingMembers.map((m) => m.userId),
      ...pendingInvites.map((i) => i.invitedUserId).filter((id) => id != null)
    ];

    let eligiblePeople = [];

    if (type === 'students') {
      eligiblePeople = await Student.find({
        sectionId: classroom.sectionId,
        status: 'active',
        userId: { $nin: excludedUserIds }
      })
        .populate({
          path: 'userId',
          select: 'email profileImage'
        })
        .select('firstName lastName registerNumber rollNumber userId')
        .lean();
    } else if (type === 'faculties') {
      eligiblePeople = await Faculty.find({
        status: 'active',
        userId: { $nin: excludedUserIds }
      })
        .populate({
          path: 'userId',
          select: 'email profileImage'
        })
        .populate({
          path: 'departmentId',
          select: 'name code'
        })
        .select('firstName lastName designation employeeId departmentId userId')
        .lean();
    } else {
      return next(
        new AppError('Invalid type parameter. Use "students" or "staffs".', 400)
      );
    }

    const results = eligiblePeople.map((person) => ({
      _id: person._id,
      userId: person.userId?._id || person.userId,
      firstName: person.firstName,
      lastName: person.lastName,
      fullName: `${person.firstName} ${person.lastName}`,
      email: person.userId?.email,
      profileImage: person.userId?.profileImage || null,
      designation: person.designation || null,
      deptCode: person.departmentId?.code || null,
      deptName: person.departmentId?.name || null,
      registerNumber: person.registerNumber || null,
      rollNumber: person.rollNumber || null
    }));

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  }
);

export const inviteMembers = catchAsync(async (req, res, next) => {
  const { classroomId } = req.params;
  const { userIds, role } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await ensureClassroomAccess({
      classroomId,
      user: req.user,
      requireFaculty: true
    });

    const classroom = await Classroom.findById(classroomId)
      .populate({
        path: 'subjectId',
        select: 'name code'
      })
      .session(session);
    if (!classroom) throw new AppError('Classroom not found', 404);

    const invitationData = [];
    const emailPromises = [];

    for (const targetId of userIds) {
      let targetUser;
      if (role === 'STUDENT') {
        targetUser = await Student.findOne({ userId: targetId }).session(
          session
        );
        if (
          !targetUser ||
          targetUser.sectionId.toString() !== classroom.sectionId.toString()
        ) {
          throw new AppError(
            `User ${targetId} does not belong to this section`,
            403
          );
        }
      } else {
        targetUser = await Faculty.findOne({ userId: targetId }).session(
          session
        );
        if (!targetUser)
          throw new AppError(`Faculty ${targetId} not found`, 404);
      }

      const userAccount = await User.findById(targetId).session(session);

      const token = crypto.randomBytes(32).toString('hex');

      invitationData.push({
        classroomId,
        invitedUserId: targetId,
        invitedEmail: userAccount.email,
        role: role.toUpperCase(),
        token,
        invitedBy: req.user._id,
        status: 'pending'
      });

      const inviteUrl = `${process.env.FRONTEND_URL}/${role.toLowerCase()}/invitation?classroomId=${classroomId}&token=${token}`;
      const message = generateHTMLContent(classroom.subjectId.name, inviteUrl);

      emailPromises.push(
        sendEmail({
          to: userAccount.email,
          subject: `Classroom Invitation - ${classroom.subjectId.name}`,
          html: message
        })
      );
    }
    await Promise.all(emailPromises);
    await ClassroomInvitation.insertMany(invitationData, { session });

    await session.commitTransaction();
    res
      .status(200)
      .json({ success: true, message: 'All invitations sent successfully' });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

export const respondToInvitation = catchAsync(async (req, res, next) => {
  const { token, action } = req.body;
  const userId = req.user._id;

  if (!['accepted', 'rejected'].includes(action)) {
    return next(
      new AppError('Invalid action. Use "accepted" or "rejected".', 400)
    );
  }

  const invitation = await ClassroomInvitation.findOne({
    token,
    status: 'pending',
    expiresAt: { $gt: Date.now() }
  }).populate('classroomId');

  if (!invitation) {
    return next(new AppError('Invalid or expired invitation', 400));
  }

  if (invitation.invitedUserId.toString() !== userId.toString()) {
    return next(
      new AppError('This invitation was not sent to your account', 403)
    );
  }

  if (action === 'accepted') {
    if (invitation.role === 'STUDENT') {
      const studentRecord = await Student.findOne({ userId });

      if (!studentRecord) {
        return next(new AppError('Student profile not found', 404));
      }

      if (
        studentRecord.sectionId?.toString() !==
        invitation.classroomId.sectionId.toString()
      ) {
        return next(
          new AppError(
            'You are not eligible to join this classroom section',
            403
          )
        );
      }
    }

    await ClassroomMember.create({
      classroomId: invitation.classroomId._id,
      userId,
      role: invitation.role.toUpperCase(),
      status: 'active'
    });
  }

  invitation.status = action;
  await invitation.save();

  res.status(200).json({
    success: true,
    message: `Invitation ${action} successfully.`
  });
});

export const joinByCode = catchAsync(async (req, res, next) => {
  const { code } = req.params;
  const userId = req.user._id;

  const classroom = await Classroom.findOne({ joinCode: code });
  if (!classroom) return next(new AppError('Classroom not found', 404));

  const student = await Student.findOne({ userId });
  if (
    !student ||
    student.sectionId.toString() !== classroom.sectionId.toString()
  ) {
    return next(
      new AppError('You are not authorized to join this section classroom', 403)
    );
  }

  await ClassroomMember.create({
    classroomId: classroom._id,
    userId,
    role: 'STUDENT'
  });

  res.status(200).json({ success: true, message: 'Joined successfully' });
});
