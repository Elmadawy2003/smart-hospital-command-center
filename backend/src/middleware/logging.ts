import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { performance } from 'perf_hooks';

export interface LoggedRequest extends Request {
  startTime?: number;
  requestId?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Request logging middleware
export const requestLogger = (req: LoggedRequest, res: Response, next: NextFunction): void => {
  const startTime = performance.now();
  req.startTime = startTime;
  
  const requestId = req.headers['x-request-id'] as string || req.requestId;
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
  });

  // Log request body for non-GET requests (excluding sensitive data)
  if (req.method !== 'GET' && req.body) {
    const sanitizedBody = sanitizeLogData(req.body);
    logger.debug('Request body', {
      requestId,
      body: sanitizedBody,
    });
  }

  // Log query parameters
  if (Object.keys(req.query).length > 0) {
    logger.debug('Query parameters', {
      requestId,
      query: req.query,
    });
  }

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Log response
    logger.info('Outgoing response', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      contentLength: res.get('Content-Length'),
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    // Log response body for errors or debug mode
    if (res.statusCode >= 400 || process.env.LOG_LEVEL === 'debug') {
      const sanitizedBody = sanitizeLogData(body);
      logger.debug('Response body', {
        requestId,
        statusCode: res.statusCode,
        body: sanitizedBody,
      });
    }

    return originalJson.call(this, body);
  };

  next();
};

// Performance monitoring middleware
export const performanceLogger = (req: LoggedRequest, res: Response, next: NextFunction): void => {
  const startTime = performance.now();
  req.startTime = startTime;

  res.on('finish', () => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const requestId = req.headers['x-request-id'] as string || req.requestId;

    // Log performance metrics
    logger.info('Request performance', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      memoryUsage: process.memoryUsage(),
      userId: req.user?.id,
    });

    // Alert for slow requests
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        userId: req.user?.id,
      });
    }
  });

  next();
};

// Error logging middleware
export const errorLogger = (error: Error, req: LoggedRequest, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || req.requestId;
  
  logger.error('Request error', {
    requestId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
    },
    timestamp: new Date().toISOString(),
  });

  next(error);
};

// Database query logging middleware
export const dbQueryLogger = (query: string, params?: any[], duration?: number): void => {
  logger.debug('Database query', {
    query: query.replace(/\s+/g, ' ').trim(),
    params: params ? sanitizeLogData(params) : undefined,
    duration: duration ? `${duration.toFixed(2)}ms` : undefined,
    timestamp: new Date().toISOString(),
  });

  // Alert for slow queries
  if (duration && duration > 1000) { // 1 second
    logger.warn('Slow database query', {
      query: query.replace(/\s+/g, ' ').trim(),
      duration: `${duration.toFixed(2)}ms`,
    });
  }
};

// User activity logging middleware
export const userActivityLogger = (action: string, details?: any) => {
  return (req: LoggedRequest, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || req.requestId;
    
    // Log after successful response
    res.on('finish', () => {
      if (res.statusCode < 400 && req.user) {
        logger.info('User activity', {
          requestId,
          userId: req.user.id,
          userEmail: req.user.email,
          userRole: req.user.role,
          action,
          details: details || {
            method: req.method,
            url: req.url,
            params: req.params,
            query: req.query,
          },
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
        });
      }
    });

    next();
  };
};

// Security event logging
export const securityLogger = (event: string, details: any, req: Request): void => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.warn('Security event', {
    requestId,
    event,
    details,
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
    },
    timestamp: new Date().toISOString(),
  });
};

// API usage logging
export const apiUsageLogger = (req: LoggedRequest, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || req.requestId;
  
  res.on('finish', () => {
    logger.info('API usage', {
      requestId,
      endpoint: `${req.method} ${req.route?.path || req.url}`,
      statusCode: res.statusCode,
      userId: req.user?.id,
      userRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  });

  next();
};

// File operation logging
export const fileOperationLogger = (operation: string, filename: string, userId?: string): void => {
  logger.info('File operation', {
    operation,
    filename,
    userId,
    timestamp: new Date().toISOString(),
  });
};

// System health logging
export const systemHealthLogger = (): void => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  logger.info('System health', {
    memory: {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    uptime: `${(process.uptime() / 60).toFixed(2)} minutes`,
    timestamp: new Date().toISOString(),
  });
};

// Sanitize sensitive data from logs
const sanitizeLogData = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
    'session',
    'ssn',
    'social_security_number',
    'credit_card',
    'card_number',
    'cvv',
    'pin',
  ];

  const sanitized = Array.isArray(data) ? [] : {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      (sanitized as any)[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      (sanitized as any)[key] = sanitizeLogData(value);
    } else {
      (sanitized as any)[key] = value;
    }
  }

  return sanitized;
};

// Request correlation middleware
export const correlationLogger = (req: LoggedRequest, res: Response, next: NextFunction): void => {
  const correlationId = req.headers['x-correlation-id'] as string || 
                       req.headers['x-request-id'] as string || 
                       req.requestId;
  
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
    (req as any).correlationId = correlationId;
  }

  next();
};

// Structured logging for different log levels
export const structuredLogger = {
  info: (message: string, meta?: any) => logger.info(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  error: (message: string, meta?: any) => logger.error(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
};

// Log rotation and cleanup
export const logCleanup = (): void => {
  logger.info('Log cleanup initiated', {
    timestamp: new Date().toISOString(),
  });
};

export default {
  requestLogger,
  performanceLogger,
  errorLogger,
  dbQueryLogger,
  userActivityLogger,
  securityLogger,
  apiUsageLogger,
  fileOperationLogger,
  systemHealthLogger,
  correlationLogger,
  structuredLogger,
  logCleanup,
  sanitizeLogData,
};