import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

// Request ID middleware for tracking
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.get('X-Request-ID') || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Add to logger context
  (req as any).requestId = requestId;
  
  next();
};

// IP whitelist middleware
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowedIPs.length === 0) {
      return next();
    }

    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (!clientIP || !allowedIPs.includes(clientIP)) {
      logger.warn('IP not in whitelist', {
        ip: clientIP,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(403).json({
        success: false,
        message: 'Access denied from this IP address',
      });
      return;
    }
    
    next();
  };
};

// IP blacklist middleware
export const ipBlacklist = (blockedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (clientIP && blockedIPs.includes(clientIP)) {
      logger.warn('Blocked IP attempted access', {
        ip: clientIP,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }
    
    next();
  };
};

// SQL injection protection
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(\'|\"|;|--|\*|\|)/g,
    /(\b(WAITFOR|DELAY)\b)/gi,
  ];

  const checkForSQLInjection = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string') {
      return sqlPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (checkForSQLInjection(value, `${path}.${key}`)) {
          return true;
        }
      }
    }
    
    return false;
  };

  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query) || checkForSQLInjection(req.params)) {
    logger.warn('Potential SQL injection attempt detected', {
      ip: req.ip,
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(400).json({
      success: false,
      message: 'Invalid request data',
    });
    return;
  }
  
  next();
};

// XSS protection middleware
export const xssProtection = (req: Request, res: Response, next: NextFunction): void => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  ];

  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      let sanitized = value;
      xssPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
      });
      return sanitized;
    }
    
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    
    return value;
  };

  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }
  
  next();
};

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for API requests with valid API key
  const apiKey = req.get('X-API-Key');
  if (apiKey && apiKey === process.env.API_KEY) {
    return next();
  }

  const token = req.get('X-CSRF-Token') || req.body._csrf;
  const sessionToken = (req as any).session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      url: req.url,
      method: req.method,
      hasToken: !!token,
      hasSessionToken: !!sessionToken,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
    });
    return;
  }
  
  next();
};

// Content type validation
export const contentTypeValidation = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip for GET requests
    if (req.method === 'GET') {
      return next();
    }

    const contentType = req.get('Content-Type');
    
    if (!contentType) {
      res.status(400).json({
        success: false,
        message: 'Content-Type header is required',
      });
      return;
    }

    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    
    if (!isAllowed) {
      logger.warn('Invalid content type', {
        contentType,
        allowedTypes,
        ip: req.ip,
        url: req.url,
        method: req.method,
      });
      
      res.status(415).json({
        success: false,
        message: 'Unsupported Media Type',
        allowedTypes,
      });
      return;
    }
    
    next();
  };
};

// Request size limit middleware
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    
    if (contentLength > maxSize) {
      logger.warn('Request size limit exceeded', {
        contentLength,
        maxSize,
        ip: req.ip,
        url: req.url,
        method: req.method,
      });
      
      res.status(413).json({
        success: false,
        message: 'Request entity too large',
        maxSize,
      });
      return;
    }
    
    next();
  };
};

// User agent validation
export const userAgentValidation = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    logger.warn('Missing User-Agent header', {
      ip: req.ip,
      url: req.url,
      method: req.method,
    });
    
    res.status(400).json({
      success: false,
      message: 'User-Agent header is required',
    });
    return;
  }

  // Block known malicious user agents
  const maliciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /burp/i,
    /nmap/i,
    /masscan/i,
    /zap/i,
  ];

  if (maliciousPatterns.some(pattern => pattern.test(userAgent))) {
    logger.warn('Malicious User-Agent detected', {
      userAgent,
      ip: req.ip,
      url: req.url,
      method: req.method,
    });
    
    res.status(403).json({
      success: false,
      message: 'Access denied',
    });
    return;
  }
  
  next();
};

// Helmet configuration for security headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      childSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// MongoDB injection protection
export const mongoSanitizeConfig = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn('MongoDB injection attempt detected', {
      key,
      ip: req.ip,
      url: req.url,
      method: req.method,
    });
  },
});

// HTTP Parameter Pollution protection
export const hppConfig = hpp({
  whitelist: ['tags', 'categories', 'sort'], // Allow arrays for these parameters
});

// Security middleware stack
export const securityStack = [
  requestId,
  helmetConfig,
  mongoSanitizeConfig,
  hppConfig,
  sqlInjectionProtection,
  xssProtection,
  userAgentValidation,
  contentTypeValidation(),
  requestSizeLimit(),
];

// Admin-only security middleware
export const adminSecurityStack = [
  ...securityStack,
  ipWhitelist(process.env.ADMIN_ALLOWED_IPS?.split(',') || []),
];

// API security middleware
export const apiSecurityStack = [
  ...securityStack,
  csrfProtection,
];

export default {
  requestId,
  ipWhitelist,
  ipBlacklist,
  sqlInjectionProtection,
  xssProtection,
  csrfProtection,
  contentTypeValidation,
  requestSizeLimit,
  userAgentValidation,
  helmetConfig,
  mongoSanitizeConfig,
  hppConfig,
  securityStack,
  adminSecurityStack,
  apiSecurityStack,
};