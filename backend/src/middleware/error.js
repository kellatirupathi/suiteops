// Wraps async route handlers so thrown errors reach the error middleware.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  // eslint-disable-line no-unused-vars
  console.error('[error]', err.message);

  let status = err.statusCode || 500;
  let message = err.message || 'Server error';

  // Postgres unique-violation -> 409
  if (err.code === '23505') {
    status = 409;
    message = 'Duplicate value violates a unique constraint';
  }
  // Postgres check / not-null violations -> 400
  if (err.code === '23514' || err.code === '23502' || err.code === '22P02') {
    status = 400;
  }

  res.status(status).json({ message });
}

export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
