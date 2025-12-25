import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { getRedisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

// Default rate limit configuration
const defaultConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  },
};

// General API rate limiter
export const apiLimiter = rateLimit({
  ...defaultConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  ...defaultConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Password reset rate limiter
export const passwordResetLimiter = rateLimit({
  ...defaultConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.',
    retryAfter: '1 hour'
  },
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  ...defaultConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    success: false,
    message: 'Too many file uploads, please try again later.',
    retryAfter: '1 hour'
  },
});

// Search rate limiter (more lenient for search operations)
export const searchLimiter = rateLimit({
  ...defaultConfig,
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: {
    success: false,
    message: 'Too many search requests, please slow down.',
    retryAfter: '1 minute'
  },
});

// Admin operations rate limiter
export const adminLimiter = rateLimit({
  ...defaultConfig,
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 admin operations per 5 minutes
  message: {
    success: false,
    message: 'Too many admin operations, please try again later.',
    retryAfter: '5 minutes'
  },
});

// Create custom rate limiter
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    ...defaultConfig,
    ...options,
    message: {
      success: false,
      message: options.message || 'Too many requests, please try again later.',
      retryAfter: `${Math.ceil(options.windowMs / 60000)} minutes`
    },
  });
};

// Rate limiter for specific user roles
export const roleBasedLimiter = (roleConfig: Record<string, { windowMs: number; max: number }>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    
    if (!userRole || !roleConfig[userRole]) {
      return next();
    }

    const config = roleConfig[userRole];
    const limiter = createRateLimiter(config);
    
    return limiter(req, res, next);
  };
};

// IP-based rate limiter with whitelist
export const ipLimiter = (whitelist: string[] = []) => {
  return rateLimit({
    ...defaultConfig,
    skip: (req: Request) => {
      return req.ip ? whitelist.includes(req.ip) : false;
    },
  });
};

// Burst rate limiter (allows short bursts but limits sustained usage)
export const burstLimiter = rateLimit({
  ...defaultConfig,
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: {
    success: false,
    message: 'Request rate too high, please slow down.',
    retryAfter: '1 minute'
  },
});

export default {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  uploadLimiter,
  searchLimiter,
  adminLimiter,
  createRateLimiter,
  roleBasedLimiter,
  ipLimiter,
  burstLimiter,
};