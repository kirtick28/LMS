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

app.use(globalErrorHandler);

// Backend Check
app.get('/', (req, res) => {
  res.send('LMS Backend is running ✅');
});

export default app;
