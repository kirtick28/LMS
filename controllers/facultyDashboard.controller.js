import Faculty from "../models/Faculty.js";
import Attendance from "../models/Attendance.js";

export const getFacultyDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // ✅ Get faculty
    const faculty = await Faculty.findOne({ userId })
      .select("_id")
      .lean();

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found"
      });
    }

    // =========================
    // 1️⃣ TOTAL CLASSES
    // =========================
    const totalClasses = await Attendance.countDocuments({
      faculty: faculty._id
    });

    // =========================
    // 2️⃣ TOTAL STUDENTS
    // =========================
    const studentsAgg = await Attendance.aggregate([
      { $match: { faculty: faculty._id } },
      { $unwind: "$records" },
      { $group: { _id: "$records.student" } },
      { $count: "totalStudents" }
    ]);

    const totalStudents = studentsAgg[0]?.totalStudents || 0;

    // =========================
    // 3️⃣ OVERALL ATTENDANCE %
    // =========================
    const attendanceAgg = await Attendance.aggregate([
      { $match: { faculty: faculty._id } },
      {
        $group: {
          _id: null,
          totalPresent: {
            $sum: {
              $size: {
                $filter: {
                  input: "$records",
                  as: "r",
                  cond: { $eq: ["$$r.status", "Present"] }
                }
              }
            }
          },
          totalStudents: {
            $sum: { $size: "$records" }
          }
        }
      }
    ]);

    const overallPercentage = attendanceAgg.length
      ? Math.round(
          (attendanceAgg[0].totalPresent /
            attendanceAgg[0].totalStudents) *
            100
        )
      : 0;

    // =========================
    // 4️⃣ SUBJECT PERFORMANCE
    // =========================
    const subjectPerformance = await Attendance.aggregate([
      { $match: { faculty: faculty._id } },

      {
        $lookup: {
          from: "classrooms",
          localField: "classroom",
          foreignField: "_id",
          as: "classroom"
        }
      },
      { $unwind: "$classroom" },

      {
        $lookup: {
          from: "subjectcomponents",
          localField: "classroom.subjectId",
          foreignField: "_id",
          as: "subject"
        }
      },
      { $unwind: "$subject" },

      {
        $group: {
          _id: "$subject.name",
          totalPresent: {
            $sum: {
              $size: {
                $filter: {
                  input: "$records",
                  as: "r",
                  cond: { $eq: ["$$r.status", "Present"] }
                }
              }
            }
          },
          totalStudents: {
            $sum: { $size: "$records" }
          }
        }
      }
    ]);

    const subjects = subjectPerformance.map((item) => ({
      subject: item._id,
      percentage: item.totalStudents
        ? Math.round((item.totalPresent / item.totalStudents) * 100)
        : 0
    }));

    // =========================
    // 5️⃣ TODAY SCHEDULE
    // =========================
    const today = new Date().toISOString().split("T")[0];

    const todaySchedule = await Attendance.find({
      faculty: faculty._id,
      dateString: today
    })
      .populate({
        path: "classroom",
        populate: {
          path: "subjectId sectionId"
        }
      })
      .lean();

    const schedule = todaySchedule.map((item) => ({
      subject: item.classroom?.subjectId?.name || "",
      section: item.classroom?.sectionId?.name || "",
      time: "09:00 AM - 12:00 PM"
    }));

    // =========================
    // ✅ FINAL RESPONSE
    // =========================
    res.json({
      success: true,
      data: {
        totalClasses,
        totalStudents,
        overallPercentage,
        subjectPerformance: subjects,
        todaySchedule: schedule
      }
    });

  } catch (err) {
    console.error("Dashboard Error:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};