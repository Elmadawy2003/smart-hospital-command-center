import { Router } from 'express';
import {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  getPatientMedicalHistory,
  searchPatients
} from '../controllers/patientController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { patientSchemas } from '../middleware/validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   POST /api/patients
 * @desc    Create a new patient
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.post(
  '/',
  authorize(['doctor', 'nurse', 'receptionist']),
  validate(patientSchemas.create),
  createPatient
);

/**
 * @route   GET /api/patients
 * @desc    Get all patients with pagination and filtering
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.get(
  '/',
  authorize(['doctor', 'nurse', 'receptionist']),
  getPatients
);

/**
 * @route   GET /api/patients/search
 * @desc    Search patients by name, email, or phone
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.get(
  '/search',
  authorize(['doctor', 'nurse', 'receptionist']),
  searchPatients
);

/**
 * @route   GET /api/patients/:id
 * @desc    Get patient by ID
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.get(
  '/:id',
  authorize(['doctor', 'nurse', 'receptionist']),
  getPatientById
);

/**
 * @route   PUT /api/patients/:id
 * @desc    Update patient information
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.put(
  '/:id',
  authorize(['doctor', 'nurse', 'receptionist']),
  validate(patientSchemas.update),
  updatePatient
);

/**
 * @route   DELETE /api/patients/:id
 * @desc    Delete patient (soft delete)
 * @access  Private (Doctor, Admin)
 */
router.delete(
  '/:id',
  authorize(['doctor', 'admin']),
  deletePatient
);

/**
 * @route   GET /api/patients/:id/medical-history
 * @desc    Get patient's medical history
 * @access  Private (Doctor, Nurse)
 */
router.get(
  '/:id/medical-history',
  authorize(['doctor', 'nurse']),
  getPatientMedicalHistory
);

export default router;