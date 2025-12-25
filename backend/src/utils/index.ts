// Export all utility functions and constants
export * from './logger';
export * from './validation';
export * from './helpers';
export * from './constants';
export * from './database';
export * from './redis';

// Re-export commonly used items for convenience
export {
  // Logger
  logger,
  logInfo,
  logError,
  logWarn,
  logDebug,
  auditLog,
} from './logger';

export {
  // Validation
  handleValidationErrors,
  isValidUUID,
  isValidEmail,
  isValidPhone,
  isValidPassword,
  ValidationError,
} from './validation';

export {
  // Helpers
  generateId,
  generateMRN,
  generateEmployeeId,
  generateBillNumber,
  calculateAge,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  maskData,
  maskEmail,
  maskPhone,
  generateRandomPassword,
  generateOTP,
  retry,
  debounce,
  throttle,
  deepClone,
  cleanObject,
  calculateBMI,
  getBMICategory,
  generatePaginationMeta,
} from './helpers';

export {
  // Constants
  CONSTANTS,
  MESSAGES,
  USER_ROLES,
  PERMISSIONS,
  APPOINTMENT_STATUS,
  PATIENT_STATUS,
  GENDER,
  BLOOD_TYPES,
  DEPARTMENTS,
} from './constants';

export {
  // Database
  connectDatabase,
  getPool,
  query,
  queryOne,
  queryMany,
  transaction,
  buildWhereClause,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildDeleteQuery,
  exists as dbExists,
  count as dbCount,
  closeDatabase,
  healthCheck as dbHealthCheck,
} from './database';

export {
  // Redis
  connectRedis,
  getRedis,
  set as redisSet,
  get as redisGet,
  del as redisDel,
  exists as redisExists,
  expire as redisExpire,
  incr as redisIncr,
  mget as redisMget,
  mset as redisMset,
  keys as redisKeys,
  deletePattern as redisDeletePattern,
  hset as redisHset,
  hget as redisHget,
  hgetall as redisHgetall,
  publish as redisPublish,
  flushall as redisFlushall,
  closeRedis,
  healthCheck as redisHealthCheck,
} from './redis';