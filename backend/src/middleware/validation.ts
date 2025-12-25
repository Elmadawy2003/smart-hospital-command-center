import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '@/utils/logger';

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}

// Common validation schemas
export const commonSchemas = {
  id: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required(),
  phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional(),
  date: Joi.date().iso().required(),
  optionalDate: Joi.date().iso().optional(),
  name: Joi.string().min(2).max(100).required(),
  optionalName: Joi.string().min(2).max(100).optional(),
  gender: Joi.string().valid('male', 'female', 'other').required(),
  bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').optional(),
  userRole: Joi.string().valid('admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech', 'radiologist', 'hr', 'finance', 'receptionist').required(),
  appointmentStatus: Joi.string().valid('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show').optional(),
  appointmentType: Joi.string().valid('consultation', 'follow_up', 'emergency', 'surgery', 'checkup', 'vaccination').required(),
  paymentStatus: Joi.string().valid('pending', 'paid', 'partial', 'cancelled', 'refunded').optional(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

// User validation schemas
export const userSchemas = {
  register: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    first_name: commonSchemas.name,
    last_name: commonSchemas.name,
    role: commonSchemas.userRole,
    department: Joi.string().max(100).optional(),
    phone: commonSchemas.phone,
    address: Joi.string().max(500).optional(),
    date_of_birth: commonSchemas.optionalDate,
    hire_date: commonSchemas.date,
    salary: Joi.number().positive().optional(),
  }),
  
  login: Joi.object({
    email: commonSchemas.email,
    password: Joi.string().required(),
  }),
  
  updateProfile: Joi.object({
    first_name: commonSchemas.optionalName,
    last_name: commonSchemas.optionalName,
    phone: commonSchemas.phone,
    address: Joi.string().max(500).optional(),
    date_of_birth: commonSchemas.optionalDate,
  }),
  
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
  }),

  forgotPassword: Joi.object({
    email: commonSchemas.email,
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: commonSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  }),
};

// Patient validation schemas
export const patientSchemas = {
  create: Joi.object({
    first_name: commonSchemas.name,
    last_name: commonSchemas.name,
    date_of_birth: commonSchemas.date,
    gender: commonSchemas.gender,
    phone: commonSchemas.phone,
    email: Joi.string().email().optional(),
    address: Joi.string().max(500).optional(),
    emergency_contact: Joi.object({
      name: Joi.string().required(),
      relationship: Joi.string().required(),
      phone: Joi.string().required(),
    }).optional(),
    insurance_info: Joi.object({
      provider: Joi.string().optional(),
      policy_number: Joi.string().optional(),
      group_number: Joi.string().optional(),
    }).optional(),
    blood_type: commonSchemas.bloodType,
    allergies: Joi.array().items(Joi.string()).optional(),
    medical_history: Joi.array().items(Joi.string()).optional(),
  }),
  
  update: Joi.object({
    first_name: commonSchemas.optionalName,
    last_name: commonSchemas.optionalName,
    phone: commonSchemas.phone,
    email: Joi.string().email().optional(),
    address: Joi.string().max(500).optional(),
    emergency_contact: Joi.object({
      name: Joi.string().required(),
      relationship: Joi.string().required(),
      phone: Joi.string().required(),
    }).optional(),
    insurance_info: Joi.object({
      provider: Joi.string().optional(),
      policy_number: Joi.string().optional(),
      group_number: Joi.string().optional(),
    }).optional(),
    blood_type: commonSchemas.bloodType,
    allergies: Joi.array().items(Joi.string()).optional(),
    medical_history: Joi.array().items(Joi.string()).optional(),
  }),
};

// Appointment validation schemas
export const appointmentSchemas = {
  create: Joi.object({
    patient_id: commonSchemas.id,
    doctor_id: commonSchemas.id,
    appointment_date: Joi.date().iso().min('now').required(),
    duration: Joi.number().integer().min(15).max(480).default(30),
    type: commonSchemas.appointmentType,
    notes: Joi.string().max(1000).optional(),
    room_number: Joi.string().max(10).optional(),
  }),
  
  update: Joi.object({
    appointment_date: Joi.date().iso().min('now').optional(),
    duration: Joi.number().integer().min(15).max(480).optional(),
    type: commonSchemas.appointmentType.optional(),
    status: commonSchemas.appointmentStatus,
    notes: Joi.string().max(1000).optional(),
    room_number: Joi.string().max(10).optional(),
  }),
};

// Medical record validation schemas
export const medicalRecordSchemas = {
  create: Joi.object({
    patient_id: commonSchemas.id,
    doctor_id: commonSchemas.id,
    diagnosis: Joi.string().min(10).max(2000).required(),
    symptoms: Joi.array().items(Joi.string()).min(1).required(),
    treatment: Joi.string().max(2000).optional(),
    medications: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      dosage: Joi.string().required(),
      frequency: Joi.string().required(),
      duration: Joi.string().required(),
    })).optional(),
    notes: Joi.string().max(2000).optional(),
    follow_up_date: commonSchemas.optionalDate,
  }),
  
  update: Joi.object({
    diagnosis: Joi.string().min(10).max(2000).optional(),
    symptoms: Joi.array().items(Joi.string()).optional(),
    treatment: Joi.string().max(2000).optional(),
    medications: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      dosage: Joi.string().required(),
      frequency: Joi.string().required(),
      duration: Joi.string().required(),
    })).optional(),
    notes: Joi.string().max(2000).optional(),
    follow_up_date: commonSchemas.optionalDate,
  }),
};

// Billing validation schemas
export const billingSchemas = {
  createBill: Joi.object({
    patient_id: commonSchemas.id,
    items: Joi.array().items(Joi.object({
      description: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      unit_price: Joi.number().positive().required(),
      item_type: Joi.string().optional(),
      reference_id: commonSchemas.id.optional(),
    })).min(1).required(),
    discount_amount: Joi.number().min(0).default(0),
    tax_rate: Joi.number().min(0).max(1).default(0),
    due_date: commonSchemas.optionalDate,
    notes: Joi.string().max(500).optional(),
  }),
  
  createPayment: Joi.object({
    bill_id: commonSchemas.id,
    amount: Joi.number().positive().required(),
    payment_method: Joi.string().valid('cash', 'card', 'bank_transfer', 'insurance', 'check').required(),
    payment_reference: Joi.string().max(255).optional(),
    notes: Joi.string().max(500).optional(),
  }),
};

// Inventory validation schemas
export const inventorySchemas = {
  createItem: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    category: Joi.string().valid('medication', 'equipment', 'supply', 'consumable').required(),
    description: Joi.string().max(1000).optional(),
    unit: Joi.string().max(50).required(),
    minimum_stock: Joi.number().integer().min(0).default(10),
    maximum_stock: Joi.number().integer().min(0).optional(),
    unit_cost: Joi.number().positive().optional(),
    supplier: Joi.string().max(255).optional(),
    location: Joi.string().max(100).optional(),
    expiry_date: commonSchemas.optionalDate,
  }),
  
  updateStock: Joi.object({
    quantity: Joi.number().integer().required(),
    movement_type: Joi.string().valid('in', 'out', 'adjustment', 'expired', 'damaged').required(),
    reason: Joi.string().max(255).optional(),
    reference_number: Joi.string().max(100).optional(),
    cost_per_unit: Joi.number().positive().optional(),
  }),
};

// Generic validation middleware
export const validate = (schema: Joi.ObjectSchema, source: 'body' | 'params' | 'query' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[source];
    
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      logger.warn('Validation failed', {
        url: req.url,
        method: req.method,
        errors,
        userId: (req as any).user?.id,
      });

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
      return;
    }

    // Replace the original data with validated and sanitized data
    req[source] = value;
    next();
  };
};

// Validate pagination parameters
export const validatePagination = validate(commonSchemas.pagination, 'query');

// Validate ID parameter
export const validateId = validate(Joi.object({ id: commonSchemas.id }), 'params');

// Sanitize input data
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Remove potential XSS attacks
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Custom validation for file uploads
export const validateFileUpload = (options: {
  allowedTypes?: string[];
  maxSize?: number;
  required?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const file = req.file;
    const files = req.files;

    if (options.required && !file && (!files || (Array.isArray(files) && files.length === 0))) {
      res.status(400).json({
        success: false,
        message: 'File upload is required',
      });
      return;
    }

    const validateSingleFile = (fileToValidate: Express.Multer.File) => {
      if (options.allowedTypes && !options.allowedTypes.includes(fileToValidate.mimetype)) {
        return `File type ${fileToValidate.mimetype} is not allowed`;
      }

      if (options.maxSize && fileToValidate.size > options.maxSize) {
        return `File size ${fileToValidate.size} exceeds maximum allowed size of ${options.maxSize}`;
      }

      return null;
    };

    if (file) {
      const error = validateSingleFile(file);
      if (error) {
        res.status(400).json({
          success: false,
          message: error,
        });
        return;
      }
    }

    if (files && Array.isArray(files)) {
      for (const fileToValidate of files) {
        const error = validateSingleFile(fileToValidate);
        if (error) {
          res.status(400).json({
            success: false,
            message: error,
          });
          return;
        }
      }
    }

    next();
  };
};

export default {
  validate,
  validatePagination,
  validateId,
  sanitizeInput,
  validateFileUpload,
  userSchemas,
  patientSchemas,
  appointmentSchemas,
  medicalRecordSchemas,
  billingSchemas,
  inventorySchemas,
  commonSchemas,
};