import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

interface RequestWithId extends Request {
  requestId?: string;
  startTime?: number;
}

// Request logging middleware
export const requestLogger = (req: RequestWithId, res: Response, next: NextFunction) => {
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - (req.startTime || 0);
    
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: JSON.stringify(body).length,
      timestamp: new Date().toISOString()
    });

    return originalJson.call(this, body);
  };

  next();
};

// Performance monitoring middleware
export const performanceLogger = (req: RequestWithId, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log performance metrics
    logger.info('Performance metrics', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });

    // Log slow requests (> 5 seconds)
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      });
    }
  });

  next();
};

// AI service specific logging
export const aiServiceLogger = (serviceName: string) => {
  return (req: RequestWithId, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    logger.info(`${serviceName} service called`, {
      requestId: req.requestId,
      service: serviceName,
      method: req.method,
      url: req.url,
      body: req.method === 'POST' ? req.body : undefined,
      timestamp: new Date().toISOString()
    });

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      logger.info(`${serviceName} service completed`, {
        requestId: req.requestId,
        service: serviceName,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    });

    next();
  };
};

// Error logging middleware
export const errorLogger = (error: Error, req: RequestWithId, res: Response, next: NextFunction) => {
  logger.error('Request error', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    timestamp: new Date().toISOString()
  });

  next(error);
};

// Model performance logging
export const logModelPerformance = (
  modelName: string, 
  operation: string, 
  duration: number, 
  inputSize?: number, 
  outputSize?: number,
  accuracy?: number
) => {
  logger.info('Model performance', {
    model: modelName,
    operation,
    duration: `${duration}ms`,
    inputSize,
    outputSize,
    accuracy,
    timestamp: new Date().toISOString()
  });
};

// Prediction logging
export const logPrediction = (
  modelName: string,
  predictionType: string,
  inputData: any,
  prediction: any,
  confidence?: number,
  userId?: string
) => {
  logger.info('AI prediction made', {
    model: modelName,
    predictionType,
    inputDataSize: JSON.stringify(inputData).length,
    prediction: typeof prediction === 'object' ? 'complex_object' : prediction,
    confidence,
    userId,
    timestamp: new Date().toISOString()
  });
};

// Training logging
export const logTraining = (
  modelName: string,
  trainingData: {
    size: number;
    features: number;
    epochs?: number;
  },
  performance: {
    accuracy?: number;
    loss?: number;
    duration: number;
  }
) => {
  logger.info('Model training completed', {
    model: modelName,
    trainingData,
    performance: {
      ...performance,
      duration: `${performance.duration}ms`
    },
    timestamp: new Date().toISOString()
  });
};

// Cache logging
export const logCacheOperation = (
  operation: 'hit' | 'miss' | 'set' | 'delete',
  key: string,
  duration?: number
) => {
  logger.debug('Cache operation', {
    operation,
    key,
    duration: duration ? `${duration}ms` : undefined,
    timestamp: new Date().toISOString()
  });
};

// Security logging
export const logSecurityEvent = (
  event: string,
  details: any,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  req?: RequestWithId
) => {
  logger.warn('Security event', {
    event,
    severity,
    details,
    requestId: req?.requestId,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
};

export {
  logger,
  requestLogger,
  performanceLogger,
  aiServiceLogger,
  errorLogger,
  logModelPerformance,
  logPrediction,
  logTraining,
  logCacheOperation,
  logSecurityEvent
};