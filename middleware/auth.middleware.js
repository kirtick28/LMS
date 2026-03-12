import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Faculty from '../models/Faculty.js';

/* ============================
   PROTECT ROUTES
============================ */
export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    req.user = user.toObject ? user.toObject() : { ...user };
    if (user.role === 'FACULTY') {
      const faculty = await Faculty.findOne({ userId: user._id }).lean();
      if (!faculty) {
        return res.status(404).json({
          success: false,
          message: 'Faculty not found',
          data: {}
        });
      }
      req.user.departmentId = faculty.departmentId;
      req.user.role = 'HOD';
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};

/* ============================
   ROLE-BASED AUTH
============================ */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }
    next();
  };
};
