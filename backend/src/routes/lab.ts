import { Router } from 'express';
import {
  createLabOrder,
  getLabOrders,
  getLabOrderById,
  updateLabOrderStatus,
  createLabResult,
  getLabResults,
  updateLabResult,
  getLabStats
} from '../controllers/labController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   POST /api/lab/orders
 * @desc    Create a new lab order
 * @access  Private (Doctor, Nurse)
 */
router.post(
  '/orders',
  authorize(['doctor', 'nurse']),
  createLabOrder
);

/**
 * @route   GET /api/lab/orders
 * @desc    Get all lab orders with pagination and filtering
 * @access  Private (Doctor, Nurse, Lab Technician)
 */
router.get(
  '/orders',
  authorize(['doctor', 'nurse', 'lab_technician']),
  getLabOrders
);

/**
 * @route   GET /api/lab/orders/:id
 * @desc    Get lab order by ID
 * @access  Private (Doctor, Nurse, Lab Technician)
 */
router.get(
  '/orders/:id',
  authorize(['doctor', 'nurse', 'lab_technician']),
  getLabOrderById
);

/**
 * @route   PUT /api/lab/orders/:id/status
 * @desc    Update lab order status
 * @access  Private (Lab Technician)
 */
router.put(
  '/orders/:id/status',
  authorize(['lab_technician']),
  updateLabOrderStatus
);

/**
 * @route   POST /api/lab/results
 * @desc    Create lab result
 * @access  Private (Lab Technician)
 */
router.post(
  '/results',
  authorize(['lab_technician']),
  createLabResult
);

/**
 * @route   GET /api/lab/results
 * @desc    Get all lab results with pagination and filtering
 * @access  Private (Doctor, Nurse, Lab Technician)
 */
router.get(
  '/results',
  authorize(['doctor', 'nurse', 'lab_technician']),
  getLabResults
);

/**
 * @route   PUT /api/lab/results/:id
 * @desc    Update lab result
 * @access  Private (Lab Technician)
 */
router.put(
  '/results/:id',
  authorize(['lab_technician']),
  updateLabResult
);

/**
 * @route   GET /api/lab/stats
 * @desc    Get lab statistics
 * @access  Private (Admin, Lab Manager)
 */
router.get(
  '/stats',
  authorize(['admin', 'lab_manager']),
  getLabStats
);

export default router;