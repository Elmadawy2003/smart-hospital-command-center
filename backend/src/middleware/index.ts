// Authentication and Authorization
export {
  authMiddleware,
  requireRole,
  requirePermission,
  requireDepartment,
  AuthenticatedRequest,
} from './auth';

// Error Handling
export {
  errorHandler,
  asyncHandler,
  validationErrorHandler,
  databaseErrorHandler,
  AppError,
  CustomError,
} from './errorHandler';

// Not Found Handler
export { notFoundHandler } from './notFoundHandler';

// Rate limiting middleware
export {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  uploadLimiter,
  searchLimiter,
  adminLimiter,
  createRateLimiter as createCustomRateLimiter,
  roleBasedLimiter as createRoleBasedLimiter,
  ipLimiter as createIPBasedLimiter,
  burstLimiter as createBurstLimiter,
} from './rateLimiter';

// Validation
export {
  validate,
  validatePagination,
  validateId,
  sanitizeInput,
  validateFileUpload,
  commonSchemas,
  userSchemas,
  patientSchemas,
  appointmentSchemas,
  medicalRecordSchemas,
  billingSchemas,
  inventorySchemas,
} from './validation';

// CORS middleware
export {
  corsOptions,
  devCorsOptions as developmentCorsOptions,
  prodCorsOptions as productionCorsOptions,
  apiCorsOptions,
  corsWithLogging,
  securityHeaders,
  corsErrorHandler,
} from './cors';

// Security
export {
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
} from './security';

// Logging
export {
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
  LoggedRequest,
} from './logging';

// Middleware stacks for common use cases
import { authMiddleware, requireRole } from './auth';
import { requestLogger, performanceLogger, correlationLogger } from './logging';
import { apiLimiter } from './rateLimiter';
import { securityStack } from './security';
import { corsOptions } from './cors';
import cors from 'cors';

// Standard API middleware stack
export const apiMiddlewareStack = [
  cors(corsOptions),
  correlationLogger,
  requestLogger,
  performanceLogger,
  securityStack,
  apiLimiter,
];

// Protected API middleware stack (requires authentication)
export const protectedApiMiddlewareStack = [
  cors(corsOptions),
  correlationLogger,
  requestLogger,
  performanceLogger,
  securityStack,
  apiLimiter,
  authMiddleware,
];

// Admin API middleware stack
export const adminApiMiddlewareStack = [
  cors(corsOptions),
  correlationLogger,
  requestLogger,
  performanceLogger,
  securityStack,
  apiLimiter,
  authMiddleware,
  requireRole(['admin', 'super_admin']),
];

// Public API middleware stack (no authentication required)
export const publicApiMiddlewareStack = [
  cors(corsOptions),
  correlationLogger,
  requestLogger,
  performanceLogger,
  securityStack,
];

export default {
  apiMiddlewareStack,
  protectedApiMiddlewareStack,
  adminApiMiddlewareStack,
  publicApiMiddlewareStack,
};