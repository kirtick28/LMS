import AppError from '../utils/AppError.js';

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = Object.values(err.keyValue)[0];
  const message = `Duplicate field value: ${value}. Please use another value`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

const isFacultyBulkUploadError = (req, err) => {
  return (
    req.originalUrl?.includes('/api/faculty/upload') &&
    Array.isArray(err.details?.failedRows)
  );
};

const sendErrorDev = (err, req, res) => {
  const includeBulkData = isFacultyBulkUploadError(req, err);

  console.error('DEV ERROR:', {
    message: err.message,
    statusCode: err.statusCode,
    status: err.status,
    details: err.details,
    stack: err.stack
  });

  return res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    data: includeBulkData ? err.details : {},
    details: includeBulkData ? err.details : null,
    error: err,
    stack: err.stack
  });
};

const sendErrorProd = (err, req, res) => {
  const includeBulkData = isFacultyBulkUploadError(req, err);

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      data: includeBulkData ? err.details : {},
      details: includeBulkData ? err.details : null
    });
  }

  console.error('ERROR 💥', err);

  res.status(500).json({
    success: false,
    status: 'error',
    message: 'Something went wrong!',
    data: {}
  });
};

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = err;

  if (error.name === 'CastError') error = handleCastErrorDB(error);
  if (error.code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

  if (error.name === 'MulterError') {
    error = new AppError(error.message || 'File upload error', 400);
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

export default globalErrorHandler;
