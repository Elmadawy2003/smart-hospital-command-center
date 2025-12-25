import { Router } from 'express';
import {
  getPatientReport,
  getAppointmentReport,
  getFinancialReport,
  getInventoryReport,
  getLabReport
} from '../controllers/reportController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/reports/patients
 * @desc    Generate patient report
 * @access  Private (Admin, Manager, Doctor)
 */
router.get(
  '/patients',
  authorize(['admin', 'manager', 'doctor']),
  getPatientReport
);

/**
 * @route   GET /api/reports/appointments
 * @desc    Generate appointment report
 * @access  Private (Admin, Manager, Doctor, Receptionist)
 */
router.get(
  '/appointments',
  authorize(['admin', 'manager', 'doctor', 'receptionist']),
  getAppointmentReport
);

/**
 * @route   GET /api/reports/financial
 * @desc    Generate financial report
 * @access  Private (Admin, Finance Manager)
 */
router.get(
  '/financial',
  authorize(['admin', 'finance_manager']),
  getFinancialReport
);

/**
 * @route   GET /api/reports/inventory
 * @desc    Generate inventory report
 * @access  Private (Admin, Inventory Manager)
 */
router.get(
  '/inventory',
  authorize(['admin', 'inventory_manager']),
  getInventoryReport
);

/**
 * @route   GET /api/reports/lab
 * @desc    Generate lab report
 * @access  Private (Admin, Lab Manager, Doctor)
 */
router.get(
  '/lab',
  authorize(['admin', 'lab_manager', 'doctor']),
  getLabReport
);

export default router;