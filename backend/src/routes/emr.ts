import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '@/middleware/errorHandler';
import { authMiddleware, requireRole, requirePermission } from '@/middleware/auth';
import * as emrController from '@/controllers/emrController';

const router = Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Patient validation rules
const patientValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('First name must be at least 2 characters long'),
  body('lastName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Last name must be at least 2 characters long'),
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  body('gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('address')
    .optional()
    .trim()
    .isLength({ min: 5 })
    .withMessage('Address must be at least 5 characters long'),
  body('emergencyContact')
    .optional()
    .isObject()
    .withMessage('Emergency contact must be an object'),
  body('insuranceInfo')
    .optional()
    .isObject()
    .withMessage('Insurance info must be an object'),
];

const medicalRecordValidation = [
  body('patientId')
    .isUUID()
    .withMessage('Valid patient ID is required'),
  body('diagnosis')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Diagnosis must be at least 3 characters long'),
  body('symptoms')
    .optional()
    .isArray()
    .withMessage('Symptoms must be an array'),
  body('treatment')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Treatment must be at least 3 characters long'),
  body('medications')
    .optional()
    .isArray()
    .withMessage('Medications must be an array'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must not exceed 2000 characters'),
];

const appointmentValidation = [
  body('patientId')
    .isUUID()
    .withMessage('Valid patient ID is required'),
  body('doctorId')
    .isUUID()
    .withMessage('Valid doctor ID is required'),
  body('appointmentDate')
    .isISO8601()
    .withMessage('Please provide a valid appointment date'),
  body('duration')
    .isInt({ min: 15, max: 240 })
    .withMessage('Duration must be between 15 and 240 minutes'),
  body('type')
    .isIn(['consultation', 'follow_up', 'emergency', 'surgery', 'checkup'])
    .withMessage('Invalid appointment type'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
];

// Patient routes
router.get('/patients', 
  requirePermission('read_patients'), 
  asyncHandler(emrController.getPatients)
);

router.get('/patients/:id', 
  param('id').isUUID().withMessage('Valid patient ID is required'),
  requirePermission('read_patients'), 
  asyncHandler(emrController.getPatientById)
);

router.post('/patients', 
  patientValidation,
  requirePermission('create_patients'), 
  asyncHandler(emrController.createPatient)
);

router.put('/patients/:id', 
  param('id').isUUID().withMessage('Valid patient ID is required'),
  patientValidation,
  requirePermission('update_patients'), 
  asyncHandler(emrController.updatePatient)
);

router.delete('/patients/:id', 
  param('id').isUUID().withMessage('Valid patient ID is required'),
  requirePermission('delete_patients'), 
  asyncHandler(emrController.deletePatient)
);

// Medical records routes
router.get('/patients/:patientId/records', 
  param('patientId').isUUID().withMessage('Valid patient ID is required'),
  requirePermission('read_medical_records'), 
  asyncHandler(emrController.getPatientMedicalRecords)
);

router.post('/medical-records', 
  medicalRecordValidation,
  requirePermission('create_medical_records'), 
  asyncHandler(emrController.createMedicalRecord)
);

router.put('/medical-records/:id', 
  param('id').isUUID().withMessage('Valid record ID is required'),
  medicalRecordValidation,
  requirePermission('update_medical_records'), 
  asyncHandler(emrController.updateMedicalRecord)
);

router.delete('/medical-records/:id', 
  param('id').isUUID().withMessage('Valid record ID is required'),
  requirePermission('delete_medical_records'), 
  asyncHandler(emrController.deleteMedicalRecord)
);

// Appointment routes
router.get('/appointments', 
  requirePermission('read_appointments'), 
  asyncHandler(emrController.getAppointments)
);

router.get('/appointments/:id', 
  param('id').isUUID().withMessage('Valid appointment ID is required'),
  requirePermission('read_appointments'), 
  asyncHandler(emrController.getAppointmentById)
);

router.post('/appointments', 
  appointmentValidation,
  requirePermission('create_appointments'), 
  asyncHandler(emrController.createAppointment)
);

router.put('/appointments/:id', 
  param('id').isUUID().withMessage('Valid appointment ID is required'),
  appointmentValidation,
  requirePermission('update_appointments'), 
  asyncHandler(emrController.updateAppointment)
);

router.delete('/appointments/:id', 
  param('id').isUUID().withMessage('Valid appointment ID is required'),
  requirePermission('delete_appointments'), 
  asyncHandler(emrController.deleteAppointment)
);

// Search and filter routes
router.get('/patients/search', 
  query('q').trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
  requirePermission('read_patients'), 
  asyncHandler(emrController.searchPatients)
);

router.get('/appointments/doctor/:doctorId', 
  param('doctorId').isUUID().withMessage('Valid doctor ID is required'),
  requirePermission('read_appointments'), 
  asyncHandler(emrController.getDoctorAppointments)
);

router.get('/appointments/patient/:patientId', 
  param('patientId').isUUID().withMessage('Valid patient ID is required'),
  requirePermission('read_appointments'), 
  asyncHandler(emrController.getPatientAppointments)
);

export default router;