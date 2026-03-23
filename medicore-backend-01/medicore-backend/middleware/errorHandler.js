/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  let status  = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  /* Mongoose duplicate key */
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
    status  = 409;
  }
  /* Mongoose validation */
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map(e => e.message).join('. ');
    status  = 422;
  }
  /* JWT errors */
  if (err.name === 'JsonWebTokenError')  { message = 'Invalid token.';  status = 401; }
  if (err.name === 'TokenExpiredError')  { message = 'Token expired.';  status = 401; }
  /* Mongoose cast error */
  if (err.name === 'CastError') { message = `Invalid ${err.path}: ${err.value}`; status = 400; }

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${new Date().toISOString()}] ${status} — ${message}`);
  }

  res.status(status).json({ message, ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) });
};

module.exports = errorHandler;
