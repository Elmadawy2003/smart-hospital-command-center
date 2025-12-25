// Application Constants

// API Response Messages
export const MESSAGES = {
  SUCCESS: {
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    RETRIEVED: 'Resource retrieved successfully',
    LOGIN: 'Login successful',
    LOGOUT: 'Logout successful',
    PASSWORD_RESET: 'Password reset successful',
    EMAIL_SENT: 'Email sent successfully',
    NOTIFICATION_SENT: 'Notification sent successfully',
  },
  ERROR: {
    INTERNAL_SERVER: 'Internal server error',
    NOT_FOUND: 'Resource not found',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    VALIDATION_FAILED: 'Validation failed',
    INVALID_CREDENTIALS: 'Invalid credentials',
    TOKEN_EXPIRED: 'Token expired',
    TOKEN_INVALID: 'Invalid token',
    USER_EXISTS: 'User already exists',
    USER_NOT_FOUND: 'User not found',
    PATIENT_NOT_FOUND: 'Patient not found',
    APPOINTMENT_NOT_FOUND: 'Appointment not found',
    DOCTOR_NOT_FOUND: 'Doctor not found',
    DEPARTMENT_NOT_FOUND: 'Department not found',
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
    INVALID_FILE_TYPE: 'Invalid file type',
    FILE_TOO_LARGE: 'File too large',
    DUPLICATE_ENTRY: 'Duplicate entry',
    OPERATION_FAILED: 'Operation failed',
  },
};

// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  NURSE: 'nurse',
  PHARMACIST: 'pharmacist',
  LAB_TECHNICIAN: 'lab_technician',
  RADIOLOGIST: 'radiologist',
  RECEPTIONIST: 'receptionist',
  ACCOUNTANT: 'accountant',
  HR_MANAGER: 'hr_manager',
  PATIENT: 'patient',
} as const;

// Permissions
export const PERMISSIONS = {
  // User Management
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  
  // Patient Management
  PATIENT_CREATE: 'patient:create',
  PATIENT_READ: 'patient:read',
  PATIENT_UPDATE: 'patient:update',
  PATIENT_DELETE: 'patient:delete',
  
  // Appointment Management
  APPOINTMENT_CREATE: 'appointment:create',
  APPOINTMENT_READ: 'appointment:read',
  APPOINTMENT_UPDATE: 'appointment:update',
  APPOINTMENT_DELETE: 'appointment:delete',
  
  // Medical Records
  MEDICAL_RECORD_CREATE: 'medical_record:create',
  MEDICAL_RECORD_READ: 'medical_record:read',
  MEDICAL_RECORD_UPDATE: 'medical_record:update',
  MEDICAL_RECORD_DELETE: 'medical_record:delete',
  
  // Pharmacy
  PHARMACY_CREATE: 'pharmacy:create',
  PHARMACY_READ: 'pharmacy:read',
  PHARMACY_UPDATE: 'pharmacy:update',
  PHARMACY_DELETE: 'pharmacy:delete',
  
  // Laboratory
  LAB_CREATE: 'lab:create',
  LAB_READ: 'lab:read',
  LAB_UPDATE: 'lab:update',
  LAB_DELETE: 'lab:delete',
  
  // Finance
  FINANCE_CREATE: 'finance:create',
  FINANCE_READ: 'finance:read',
  FINANCE_UPDATE: 'finance:update',
  FINANCE_DELETE: 'finance:delete',
  
  // HR
  HR_CREATE: 'hr:create',
  HR_READ: 'hr:read',
  HR_UPDATE: 'hr:update',
  HR_DELETE: 'hr:delete',
  
  // Reports
  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',
  
  // Dashboard
  DASHBOARD_READ: 'dashboard:read',
  
  // System Administration
  SYSTEM_ADMIN: 'system:admin',
} as const;

// Appointment Status
export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  RESCHEDULED: 'rescheduled',
} as const;

// Appointment Types
export const APPOINTMENT_TYPES = {
  CONSULTATION: 'consultation',
  FOLLOW_UP: 'follow_up',
  EMERGENCY: 'emergency',
  SURGERY: 'surgery',
  CHECKUP: 'checkup',
  VACCINATION: 'vaccination',
  THERAPY: 'therapy',
} as const;

// Patient Status
export const PATIENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DISCHARGED: 'discharged',
  ADMITTED: 'admitted',
  EMERGENCY: 'emergency',
  DECEASED: 'deceased',
} as const;

// Gender
export const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
} as const;

// Blood Types
export const BLOOD_TYPES = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A-',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB-',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O-',
} as const;

// Marital Status
export const MARITAL_STATUS = {
  SINGLE: 'single',
  MARRIED: 'married',
  DIVORCED: 'divorced',
  WIDOWED: 'widowed',
  SEPARATED: 'separated',
} as const;

// Employee Status
export const EMPLOYEE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ON_LEAVE: 'on_leave',
  TERMINATED: 'terminated',
  SUSPENDED: 'suspended',
} as const;

// Leave Types
export const LEAVE_TYPES = {
  ANNUAL: 'annual',
  SICK: 'sick',
  MATERNITY: 'maternity',
  PATERNITY: 'paternity',
  EMERGENCY: 'emergency',
  UNPAID: 'unpaid',
} as const;

// Leave Status
export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

// Payment Status
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PARTIAL: 'partial',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  BANK_TRANSFER: 'bank_transfer',
  INSURANCE: 'insurance',
  CHECK: 'check',
  ONLINE: 'online',
} as const;

// Bill Types
export const BILL_TYPES = {
  CONSULTATION: 'consultation',
  PROCEDURE: 'procedure',
  MEDICATION: 'medication',
  LAB_TEST: 'lab_test',
  IMAGING: 'imaging',
  ROOM_CHARGE: 'room_charge',
  SURGERY: 'surgery',
  EMERGENCY: 'emergency',
} as const;

// Medication Status
export const MEDICATION_STATUS = {
  ACTIVE: 'active',
  DISCONTINUED: 'discontinued',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
} as const;

// Prescription Status
export const PRESCRIPTION_STATUS = {
  PENDING: 'pending',
  DISPENSED: 'dispensed',
  PARTIALLY_DISPENSED: 'partially_dispensed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

// Lab Test Status
export const LAB_TEST_STATUS = {
  ORDERED: 'ordered',
  COLLECTED: 'collected',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  PENDING_REVIEW: 'pending_review',
} as const;

// Imaging Status
export const IMAGING_STATUS = {
  ORDERED: 'ordered',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  PENDING_REVIEW: 'pending_review',
} as const;

// Bed Status
export const BED_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  RESERVED: 'reserved',
  OUT_OF_ORDER: 'out_of_order',
} as const;

// Room Types
export const ROOM_TYPES = {
  GENERAL: 'general',
  PRIVATE: 'private',
  ICU: 'icu',
  EMERGENCY: 'emergency',
  SURGERY: 'surgery',
  MATERNITY: 'maternity',
  PEDIATRIC: 'pediatric',
} as const;

// Priority Levels
export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
  CRITICAL: 'critical',
} as const;

// Notification Types
export const NOTIFICATION_TYPES = {
  APPOINTMENT_REMINDER: 'appointment_reminder',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',
  LAB_RESULT_READY: 'lab_result_ready',
  MEDICATION_REMINDER: 'medication_reminder',
  BILL_GENERATED: 'bill_generated',
  PAYMENT_RECEIVED: 'payment_received',
  SYSTEM_ALERT: 'system_alert',
  LOW_STOCK: 'low_stock',
  CRITICAL_ALERT: 'critical_alert',
} as const;

// File Types
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  SPREADSHEETS: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ALL: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
} as const;

// File Size Limits (in bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  DEFAULT: 5 * 1024 * 1024, // 5MB
} as const;

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
  },
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
  },
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
  },
} as const;

// Pagination Defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// Date Formats
export const DATE_FORMATS = {
  DATE: 'yyyy-MM-dd',
  TIME: 'HH:mm',
  DATETIME: 'yyyy-MM-dd HH:mm:ss',
  DISPLAY_DATE: 'MMM dd, yyyy',
  DISPLAY_DATETIME: 'MMM dd, yyyy HH:mm',
} as const;

// Business Hours
export const BUSINESS_HOURS = {
  START: '08:00',
  END: '18:00',
  LUNCH_START: '12:00',
  LUNCH_END: '13:00',
} as const;

// Emergency Codes
export const EMERGENCY_CODES = {
  CODE_BLUE: 'code_blue', // Cardiac arrest
  CODE_RED: 'code_red', // Fire
  CODE_GRAY: 'code_gray', // Security threat
  CODE_YELLOW: 'code_yellow', // Missing patient
  CODE_GREEN: 'code_green', // Emergency activation
  CODE_SILVER: 'code_silver', // Weapon/hostage
} as const;

// Vital Signs Normal Ranges
export const VITAL_SIGNS_RANGES = {
  BLOOD_PRESSURE: {
    SYSTOLIC: { MIN: 90, MAX: 140 },
    DIASTOLIC: { MIN: 60, MAX: 90 },
  },
  HEART_RATE: { MIN: 60, MAX: 100 },
  TEMPERATURE: { MIN: 36.1, MAX: 37.2 }, // Celsius
  RESPIRATORY_RATE: { MIN: 12, MAX: 20 },
  OXYGEN_SATURATION: { MIN: 95, MAX: 100 },
} as const;

// BMI Categories
export const BMI_CATEGORIES = {
  UNDERWEIGHT: { MIN: 0, MAX: 18.5 },
  NORMAL: { MIN: 18.5, MAX: 25 },
  OVERWEIGHT: { MIN: 25, MAX: 30 },
  OBESE: { MIN: 30, MAX: 100 },
} as const;

// Department Codes
export const DEPARTMENTS = {
  EMERGENCY: 'emergency',
  CARDIOLOGY: 'cardiology',
  NEUROLOGY: 'neurology',
  ORTHOPEDICS: 'orthopedics',
  PEDIATRICS: 'pediatrics',
  OBSTETRICS: 'obstetrics',
  SURGERY: 'surgery',
  RADIOLOGY: 'radiology',
  LABORATORY: 'laboratory',
  PHARMACY: 'pharmacy',
  PSYCHIATRY: 'psychiatry',
  DERMATOLOGY: 'dermatology',
  ONCOLOGY: 'oncology',
  UROLOGY: 'urology',
  OPHTHALMOLOGY: 'ophthalmology',
  ENT: 'ent',
  ANESTHESIOLOGY: 'anesthesiology',
  PATHOLOGY: 'pathology',
  ADMINISTRATION: 'administration',
  HR: 'hr',
  FINANCE: 'finance',
  IT: 'it',
} as const;

// System Settings
export const SYSTEM_SETTINGS = {
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  PASSWORD_RESET_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  OTP_EXPIRY: 10 * 60 * 1000, // 10 minutes
  MAX_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes
} as const;

// Export all constants as a single object for easier importing
export const CONSTANTS = {
  MESSAGES,
  USER_ROLES,
  PERMISSIONS,
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPES,
  PATIENT_STATUS,
  GENDER,
  BLOOD_TYPES,
  MARITAL_STATUS,
  EMPLOYEE_STATUS,
  LEAVE_TYPES,
  LEAVE_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  BILL_TYPES,
  MEDICATION_STATUS,
  PRESCRIPTION_STATUS,
  LAB_TEST_STATUS,
  IMAGING_STATUS,
  BED_STATUS,
  ROOM_TYPES,
  PRIORITY_LEVELS,
  NOTIFICATION_TYPES,
  ALLOWED_FILE_TYPES,
  FILE_SIZE_LIMITS,
  CACHE_TTL,
  RATE_LIMITS,
  PAGINATION,
  DATE_FORMATS,
  BUSINESS_HOURS,
  EMERGENCY_CODES,
  VITAL_SIGNS_RANGES,
  BMI_CATEGORIES,
  DEPARTMENTS,
  SYSTEM_SETTINGS,
} as const;