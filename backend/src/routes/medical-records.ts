import { Router } from 'express';
import {
  createMedicalRecord,
  getMedicalRecords,
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord,
  getPatientMedicalHistory,
  searchMedicalRecords
} from '../controllers/medicalRecordController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { medicalRecordSchemas } from '../middleware/validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   POST /api/medical-records
 * @desc    Create a new medical record
 * @access  Private (Doctor, Nurse)
 */
router.post(
  '/',
  authorize(['doctor', 'nurse']),
  validate(medicalRecordSchemas.create),
  createMedicalRecord
);

/**
 * @route   GET /api/medical-records
 * @desc    Get all medical records with pagination and filtering
 * @access  Private (Doctor, Nurse)
 */
router.get(
  '/',
  authorize(['doctor', 'nurse']),
  getMedicalRecords
);

/**
 * @route   GET /api/medical-records/search
 * @desc    Search medical records
 * @access  Private (Doctor, Nurse)
 */
router.get(
  '/search',
  authorize(['doctor', 'nurse']),
  searchMedicalRecords
);

/**
 * @route   GET /api/medical-records/:id
 * @desc    Get medical record by ID
 * @access  Private (Doctor, Nurse)
 */
router.get(
  '/:id',
  authorize(['doctor', 'nurse']),
  getMedicalRecordById
);

/**
 * @route   PUT /api/medical-records/:id
 * @desc    Update medical record
 * @access  Private (Doctor, Nurse)
 */
router.put(
  '/:id',
  authorize(['doctor', 'nurse']),
  validate(medicalRecordSchemas.update),
  updateMedicalRecord
);

/**
 * @route   DELETE /api/medical-records/:id
 * @desc    Delete medical record (soft delete)
 * @access  Private (Doctor, Admin)
 */
router.delete(
  '/:id',
  authorize(['doctor', 'admin']),
  deleteMedicalRecord
);

/**
 * @route   GET /api/medical-records/patient/:patientId
 * @desc    Get patient's medical history
 * @access  Private (Doctor, Nurse)
 */
router.get(
  '/patient/:patientId',
  authorize(['doctor', 'nurse']),
  getPatientMedicalHistory
);

export default router;