const globalErrorHandler = (err, req, res, next) => {
  console.error('ERROR 💥:', err);

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Development response
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      stack: err.stack,
      error: err
    });
  }

  // Production response
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  }

  // Unknown error
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong'
  });
};

export default globalErrorHandler;
