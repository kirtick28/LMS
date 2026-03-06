import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './utils/swagger.js';

// Environment variables Configuration
dotenv.config();

// Imports
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import facultyRoutes from './routes/faculty.routes.js';
import departmentRoutes from './routes/department.routes.js';
import batchRoutes from './routes/batch.routes.js';
import sectionRoutes from './routes/section.routes.js';
import regulationRoutes from './routes/regulation.routes.js';
import curriculumRoutes from './routes/curriculum.routes.js';
import subjectRoutes from './routes/subject.routes.js';
import academicYearRoutes from './routes/academicYear.routes.js';
import batchProgramRoutes from './routes/batchProgram.routes.js';
import facultyAssignmentRoutes from './routes/facultyAssignment.routes.js';
import studentAcademicRecordRoutes from './routes/studentAcademicRecord.routes.js';
import globalErrorHandler from './middleware/error.middleware.js';

const app = express();

// Serve Static Folder
app.use('/images', express.static(path.join(process.cwd(), 'images')));
app.use('/pdf_assets', express.static(path.join(process.cwd(), 'pdf')));

// Global Middlewares
app.use(cors('*'));
app.use(express.json());
app.use(morgan('dev'));

// Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/regulations', regulationRoutes);
app.use('/api/curriculums', curriculumRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/batch-programs', batchProgramRoutes);
app.use('/api/faculty-assignments', facultyAssignmentRoutes);
app.use('/api/student-academic-records', studentAcademicRecordRoutes);

app.use(globalErrorHandler);

// Backend Check
app.get('/', (req, res) => {
  res.send('LMS Backend is running ✅');
});

export default app;
