import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from '@/utils/logger';

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.ADMIN_URL || 'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://localhost:3000',
      'https://localhost:3001',
    ];

    // Add production URLs if available
    if (process.env.PRODUCTION_FRONTEND_URL) {
      allowedOrigins.push(process.env.PRODUCTION_FRONTEND_URL);
    }
    if (process.env.PRODUCTION_ADMIN_URL) {
      allowedOrigins.push(process.env.PRODUCTION_ADMIN_URL);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS: Origin not allowed', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key',
    'X-Client-Version',
    'X-Request-ID',
  ],
  
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
  ],
  
  credentials: true, // Allow cookies to be sent
  
  maxAge: 86400, // 24 hours - how long the browser should cache preflight requests
  
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Development CORS (more permissive)
const devCorsOptions: cors.CorsOptions = {
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key',
    'X-Client-Version',
    'X-Request-ID',
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
  ],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Production CORS (more restrictive)
const prodCorsOptions: cors.CorsOptions = {
  ...corsOptions,
  origin: (origin, callback) => {
    // More strict origin checking for production
    if (!origin) {
      // In production, we might want to reject requests with no origin
      // unless they're from trusted sources
      return callback(new Error('Origin required in production'));
    }

    const allowedOrigins = [
      process.env.PRODUCTION_FRONTEND_URL,
      process.env.PRODUCTION_ADMIN_URL,
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS: Origin not allowed in production', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
};

// API-specific CORS for different endpoints
const apiCorsOptions: cors.CorsOptions = {
  ...corsOptions,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Request-ID',
  ],
};

// Public API CORS (for endpoints that don't require authentication)
const publicCorsOptions: cors.CorsOptions = {
  origin: true,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'X-Request-ID',
  ],
  credentials: false,
  maxAge: 86400,
};

// WebSocket CORS
const wsCorsOptions: cors.CorsOptions = {
  ...corsOptions,
  methods: ['GET', 'POST'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Sec-WebSocket-Protocol',
    'Sec-WebSocket-Extensions',
  ],
};

// Custom CORS middleware with logging
export const corsWithLogging = (options: cors.CorsOptions = corsOptions) => {
  const corsMiddleware = cors(options);
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Log CORS requests for monitoring
    if (req.method === 'OPTIONS') {
      logger.debug('CORS preflight request', {
        origin: req.get('Origin'),
        method: req.get('Access-Control-Request-Method'),
        headers: req.get('Access-Control-Request-Headers'),
        url: req.url,
      });
    }

    corsMiddleware(req, res, (err) => {
      if (err) {
        logger.error('CORS error', {
          error: err.message,
          origin: req.get('Origin'),
          url: req.url,
          method: req.method,
        });
        
        res.status(403).json({
          success: false,
          message: 'CORS policy violation',
          error: process.env.NODE_ENV === 'development' ? err.message : 'Access denied',
        });
        return;
      }
      
      next();
    });
  };
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );
  
  // Strict Transport Security (HTTPS only)
  if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );

  next();
};

// Environment-specific CORS
export const getCorsMiddleware = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return corsWithLogging(prodCorsOptions);
    case 'development':
      return corsWithLogging(devCorsOptions);
    case 'test':
      return corsWithLogging(publicCorsOptions);
    default:
      return corsWithLogging(corsOptions);
  }
};

// Route-specific CORS middleware
export const routeSpecificCors = {
  api: corsWithLogging(apiCorsOptions),
  public: corsWithLogging(publicCorsOptions),
  websocket: corsWithLogging(wsCorsOptions),
  admin: corsWithLogging(prodCorsOptions),
};

// CORS error handler
export const corsErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  if (err.message.includes('CORS')) {
    logger.warn('CORS violation attempt', {
      origin: req.get('Origin'),
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(403).json({
      success: false,
      message: 'Cross-origin request blocked',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  
  next(err);
};

// Named exports for individual options
export { corsOptions, devCorsOptions, prodCorsOptions, apiCorsOptions, publicCorsOptions, wsCorsOptions };

export default {
  corsWithLogging,
  securityHeaders,
  getCorsMiddleware,
  routeSpecificCors,
  corsErrorHandler,
  corsOptions,
  devCorsOptions,
  prodCorsOptions,
  apiCorsOptions,
  publicCorsOptions,
  wsCorsOptions,
};