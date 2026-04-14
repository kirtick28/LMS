import ClassroomMember from "../models/ClassroomMember.js";
import ClassroomPost from "../models/ClassroomPost.js";
import Assignment from "../models/Assignment.js";
import Quiz from "../models/Quiz.js";

export const getCalendar = async (req, res) => {
  try {
    const facultyId = req.user._id;

    // Get classrooms where faculty is a member
    const members = await ClassroomMember.find({
      userId: facultyId,
      role: "FACULTY",
      status: "active",
    }).populate("classroomId");

    const classroomIds = members.map((m) => m.classroomId._id);

    // Get posts of type assignment or quiz
    const posts = await ClassroomPost.find({
      classroomId: { $in: classroomIds },
      type: { $in: ["assignment", "quiz"] },
    }).populate({
      path: "classroomId",
      populate: [
        {
          path: "sectionId",
          populate: {
            path: "batchProgramId",
            populate: ["departmentId", "batchId"],
          },
        },
        { path: "academicYearId" },
        { path: "subjectId" },
      ],
    });

    const events = [];

    for (const post of posts) {
      let dueDate = null;
      let points = null;

      if (post.type === "assignment") {
        const assignment = await Assignment.findOne({ postId: post._id });
        if (assignment) {
          dueDate = assignment.dueDate;
          points = assignment.points;
        }
      } else if (post.type === "quiz") {
        const quiz = await Quiz.findOne({ postId: post._id });
        if (quiz) {
          dueDate = quiz.dueDate;
          points = quiz.totalMarks;
        }
      }

      if (dueDate) {
        const classroom = post.classroomId;
        const section = classroom.sectionId;
        const batchProgram = section.batchProgramId;
        const department = batchProgram.departmentId;
        const batch = batchProgram.batchId;
        const academicYear = classroom.academicYearId;
        const subject = classroom.subjectId;

        events.push({
          id: post._id,
          type: post.type,
          title: post.title,
          instructions: post.instructions,
          dueDate,
          points,
          classroom: {
            year: academicYear.name,
            department: department.name,
            section: section.name,
            subject: subject.name,
            semester: classroom.semesterNumber,
          },
        });
      }
    }

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
