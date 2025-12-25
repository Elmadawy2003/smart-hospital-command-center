import { Router } from 'express';
import {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  getDoctorSchedule,
  getAvailableSlots
} from '../controllers/appointmentController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { appointmentSchemas } from '../middleware/validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   POST /api/appointments
 * @desc    Create a new appointment
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.post(
  '/',
  authorize(['doctor', 'nurse', 'receptionist']),
  validate(appointmentSchemas.create),
  createAppointment
);

/**
 * @route   GET /api/appointments
 * @desc    Get all appointments with pagination and filtering
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.get(
  '/',
  authorize(['doctor', 'nurse', 'receptionist']),
  getAppointments
);

/**
 * @route   GET /api/appointments/:id
 * @desc    Get appointment by ID
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.get(
  '/:id',
  authorize(['doctor', 'nurse', 'receptionist']),
  getAppointmentById
);

/**
 * @route   PUT /api/appointments/:id
 * @desc    Update appointment
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.put(
  '/:id',
  authorize(['doctor', 'nurse', 'receptionist']),
  validate(appointmentSchemas.update),
  updateAppointment
);

/**
 * @route   DELETE /api/appointments/:id
 * @desc    Cancel appointment
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.delete(
  '/:id',
  authorize(['doctor', 'nurse', 'receptionist']),
  cancelAppointment
);

/**
 * @route   GET /api/appointments/doctor/:doctorId/schedule
 * @desc    Get doctor's schedule
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.get(
  '/doctor/:doctorId/schedule',
  authorize(['doctor', 'nurse', 'receptionist']),
  getDoctorSchedule
);

/**
 * @route   GET /api/appointments/available-slots
 * @desc    Get available appointment slots
 * @access  Private (Doctor, Nurse, Receptionist)
 */
router.get(
  '/available-slots',
  authorize(['doctor', 'nurse', 'receptionist']),
  getAvailableSlots
);

export default router;