import { validationResult, ValidationError } from 'express-validator';
import { Request } from 'express';
import { AppError } from '@/middleware/errorHandler';

/**
 * Handle validation errors from express-validator
 */
export const handleValidationErrors = (req: Request): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error: ValidationError) => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
    }));
    
    throw new AppError('Validation failed', 400, errorMessages);
  }
};

/**
 * Validate UUID format
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

/**
 * Validate password strength
 */
export const isValidPassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate date format and range
 */
export const isValidDate = (date: string | Date, minDate?: Date, maxDate?: Date): boolean => {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return false;
  }
  
  if (minDate && dateObj < minDate) {
    return false;
  }
  
  if (maxDate && dateObj > maxDate) {
    return false;
  }
  
  return true;
};

/**
 * Validate age based on date of birth
 */
export const isValidAge = (dateOfBirth: string | Date, minAge: number = 0, maxAge: number = 150): boolean => {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  
  if (isNaN(birthDate.getTime())) {
    return false;
  }
  
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= minAge && age - 1 <= maxAge;
  }
  
  return age >= minAge && age <= maxAge;
};

/**
 * Sanitize string input
 */
export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes to prevent injection
    .substring(0, 1000); // Limit length
};

/**
 * Validate and sanitize search query
 */
export const sanitizeSearchQuery = (query: string): string => {
  return query
    .trim()
    .replace(/[<>'"]/g, '')
    .replace(/[^\w\s\-\.]/g, '')
    .substring(0, 100);
};

/**
 * Validate numeric range
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

/**
 * Validate file upload
 */
export const validateFileUpload = (file: any, allowedTypes: string[], maxSize: number): { isValid: boolean; error?: string } => {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    return { isValid: false, error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` };
  }
  
  if (file.size > maxSize) {
    return { isValid: false, error: `File size too large. Maximum size: ${maxSize / 1024 / 1024}MB` };
  }
  
  return { isValid: true };
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (page?: string, limit?: string): { page: number; limit: number } => {
  const pageNum = parseInt(page || '1', 10);
  const limitNum = parseInt(limit || '20', 10);
  
  return {
    page: Math.max(1, isNaN(pageNum) ? 1 : pageNum),
    limit: Math.min(100, Math.max(1, isNaN(limitNum) ? 20 : limitNum)),
  };
};

/**
 * Validate time format (HH:MM)
 */
export const isValidTime = (time: string): boolean => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

/**
 * Validate appointment time (business hours)
 */
export const isValidAppointmentTime = (dateTime: string | Date): boolean => {
  const appointmentDate = new Date(dateTime);
  const hour = appointmentDate.getHours();
  const day = appointmentDate.getDay();
  
  // Check if it's a weekday (Monday to Friday)
  if (day === 0 || day === 6) {
    return false; // Weekend
  }
  
  // Check if it's within business hours (8 AM to 6 PM)
  if (hour < 8 || hour >= 18) {
    return false;
  }
  
  // Check if it's not in the past
  if (appointmentDate < new Date()) {
    return false;
  }
  
  return true;
};

/**
 * Validate medical record number format
 */
export const isValidMedicalRecordNumber = (mrn: string): boolean => {
  // Assuming format: MRN followed by 8 digits
  const mrnRegex = /^MRN\d{8}$/;
  return mrnRegex.test(mrn);
};

/**
 * Validate employee ID format
 */
export const isValidEmployeeId = (empId: string): boolean => {
  // Assuming format: EMP followed by 6 digits
  const empIdRegex = /^EMP\d{6}$/;
  return empIdRegex.test(empId);
};

/**
 * Validate bill number format
 */
export const isValidBillNumber = (billNumber: string): boolean => {
  // Assuming format: BILL followed by year and 6 digits
  const billRegex = /^BILL\d{10}$/;
  return billRegex.test(billNumber);
};

/**
 * Validate medication dosage
 */
export const isValidDosage = (dosage: string): boolean => {
  // Allow formats like: 500mg, 2.5ml, 1 tablet, etc.
  const dosageRegex = /^\d+(\.\d+)?\s*(mg|ml|g|tablet|capsule|drop|unit)s?$/i;
  return dosageRegex.test(dosage);
};

/**
 * Validate blood pressure format
 */
export const isValidBloodPressure = (bp: string): boolean => {
  // Format: systolic/diastolic (e.g., 120/80)
  const bpRegex = /^\d{2,3}\/\d{2,3}$/;
  if (!bpRegex.test(bp)) return false;
  
  const [systolic, diastolic] = bp.split('/').map(Number);
  return systolic >= 70 && systolic <= 250 && diastolic >= 40 && diastolic <= 150;
};

/**
 * Validate temperature
 */
export const isValidTemperature = (temp: number, unit: 'C' | 'F' = 'C'): boolean => {
  if (unit === 'C') {
    return temp >= 30 && temp <= 45; // Celsius
  } else {
    return temp >= 86 && temp <= 113; // Fahrenheit
  }
};

/**
 * Validate heart rate
 */
export const isValidHeartRate = (hr: number): boolean => {
  return hr >= 30 && hr <= 220;
};

/**
 * Validate weight
 */
export const isValidWeight = (weight: number, unit: 'kg' | 'lbs' = 'kg'): boolean => {
  if (unit === 'kg') {
    return weight >= 0.5 && weight <= 500; // kg
  } else {
    return weight >= 1 && weight <= 1100; // lbs
  }
};

/**
 * Validate height
 */
export const isValidHeight = (height: number, unit: 'cm' | 'ft' = 'cm'): boolean => {
  if (unit === 'cm') {
    return height >= 30 && height <= 250; // cm
  } else {
    return height >= 1 && height <= 8; // feet
  }
};

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  public field: string;
  public value: any;
  
  constructor(message: string, field: string, value?: any) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}