import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { logSecurityEvent } from './logging';

interface RequestWithId extends Request {
  requestId?: string;
}

interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

// Custom error classes
export class ValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';
  
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  statusCode = 403;
  code = 'AUTHORIZATION_ERROR';
  
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  code = 'NOT_FOUND_ERROR';
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error {
  statusCode = 429;
  code = 'RATE_LIMIT_ERROR';
  
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ModelError extends Error {
  statusCode = 500;
  code = 'MODEL_ERROR';
  
  constructor(message: string, public modelName?: string) {
    super(message);
    this.name = 'ModelError';
  }
}

export class PredictionError extends Error {
  statusCode = 500;
  code = 'PREDICTION_ERROR';
  
  constructor(message: string, public predictionType?: string) {
    super(message);
    this.name = 'PredictionError';
  }
}

export class DataError extends Error {
  statusCode = 422;
  code = 'DATA_ERROR';
  
  constructor(message: string, public dataType?: string) {
    super(message);
    this.name = 'DataError';
  }
}

export class ServiceUnavailableError extends Error {
  statusCode = 503;
  code = 'SERVICE_UNAVAILABLE_ERROR';
  
  constructor(message: string = 'Service temporarily unavailable') {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

// Main error handler middleware
export const errorHandler = (
  error: CustomError,
  req: RequestWithId,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logger.error('Request error', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    },
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const statusCode = error.statusCode || 500;
  
  // Log security events for certain errors
  if (statusCode === 401 || statusCode === 403) {
    logSecurityEvent(
      'Authentication/Authorization failure',
      {
        error: error.message,
        code: error.code
      },
      'medium',
      req
    );
  }

  // Prepare error response
  const errorResponse: any = {
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    }
  };

  // Add details for validation errors
  if (error instanceof ValidationError && error.details) {
    errorResponse.error.details = error.details;
  }

  // Add model-specific information
  if (error instanceof ModelError && error.modelName) {
    errorResponse.error.model = error.modelName;
  }

  if (error instanceof PredictionError && error.predictionType) {
    errorResponse.error.predictionType = error.predictionType;
  }

  if (error instanceof DataError && error.dataType) {
    errorResponse.error.dataType = error.dataType;
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    errorResponse.error.message = 'Internal server error';
    delete errorResponse.error.details;
  } else if (process.env.NODE_ENV !== 'production') {
    // Include stack trace in development
    errorResponse.error.stack = error.stack;
  }

  // Add retry information for certain errors
  if (statusCode === 429) {
    errorResponse.error.retryAfter = '60 seconds';
  }

  if (statusCode === 503) {
    errorResponse.error.retryAfter = '5 minutes';
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: RequestWithId, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

// Validation error handler
export const handleValidationError = (error: any): ValidationError => {
  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    
    return new ValidationError('Validation failed', details);
  }
  
  return error;
};

// Database error handler
export const handleDatabaseError = (error: any): CustomError => {
  if (error.code === 'ECONNREFUSED') {
    return new ServiceUnavailableError('Database connection failed');
  }
  
  if (error.code === '23505') { // Unique constraint violation
    return new ValidationError('Duplicate entry detected');
  }
  
  if (error.code === '23503') { // Foreign key constraint violation
    return new ValidationError('Referenced record does not exist');
  }
  
  return error;
};

// Model error handler
export const handleModelError = (error: any, modelName?: string): ModelError => {
  if (error.message?.includes('model not found')) {
    return new ModelError(`Model ${modelName} not found or not loaded`, modelName);
  }
  
  if (error.message?.includes('invalid input shape')) {
    return new ModelError(`Invalid input data format for model ${modelName}`, modelName);
  }
  
  if (error.message?.includes('out of memory')) {
    return new ModelError(`Insufficient memory to run model ${modelName}`, modelName);
  }
  
  return new ModelError(error.message || 'Model execution failed', modelName);
};

// Prediction error handler
export const handlePredictionError = (error: any, predictionType?: string): PredictionError => {
  if (error.message?.includes('insufficient data')) {
    return new PredictionError(`Insufficient data for ${predictionType} prediction`, predictionType);
  }
  
  if (error.message?.includes('invalid features')) {
    return new PredictionError(`Invalid feature data for ${predictionType} prediction`, predictionType);
  }
  
  return new PredictionError(error.message || 'Prediction failed', predictionType);
};

// Rate limit error handler
export const handleRateLimitError = (): RateLimitError => {
  return new RateLimitError('API rate limit exceeded. Please try again later.');
};

// Global uncaught exception handler
export const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    });
    
    // Graceful shutdown
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection', {
      reason: reason?.toString(),
      stack: reason?.stack,
      timestamp: new Date().toISOString()
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};

export default {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  handleValidationError,
  handleDatabaseError,
  handleModelError,
  handlePredictionError,
  handleRateLimitError,
  setupGlobalErrorHandlers,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ModelError,
  PredictionError,
  DataError,
  ServiceUnavailableError
};