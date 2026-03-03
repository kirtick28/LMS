import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
dotenv.config();

import connectDB from './config/DB.js';
connectDB();

const app = express();

// Serve Static Folder
app.use('/images', express.static(path.join(process.cwd(), 'images')));
app.use('/pdf_assets', express.static(path.join(process.cwd(), 'pdf_assets')));

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes

// Backend Check
app.get('/', (req, res) => {
  res.send('LMS Backend is running ✅');
});

export default app;
