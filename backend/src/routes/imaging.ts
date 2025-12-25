import { Router } from 'express';
import {
  createImagingOrder,
  getImagingOrders,
  getImagingOrderById,
  updateImagingOrderStatus,
  createImagingResult,
  getImagingResults,
  updateImagingResult,
  getImagingStats
} from '../controllers/imagingController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   POST /api/imaging/orders
 * @desc    Create a new imaging order
 * @access  Private (Doctor, Nurse)
 */
router.post(
  '/orders',
  authorize(['doctor', 'nurse']),
  createImagingOrder
);

/**
 * @route   GET /api/imaging/orders
 * @desc    Get all imaging orders with pagination and filtering
 * @access  Private (Doctor, Nurse, Radiologist, Imaging Technician)
 */
router.get(
  '/orders',
  authorize(['doctor', 'nurse', 'radiologist', 'imaging_technician']),
  getImagingOrders
);

/**
 * @route   GET /api/imaging/orders/:id
 * @desc    Get imaging order by ID
 * @access  Private (Doctor, Nurse, Radiologist, Imaging Technician)
 */
router.get(
  '/orders/:id',
  authorize(['doctor', 'nurse', 'radiologist', 'imaging_technician']),
  getImagingOrderById
);

/**
 * @route   PUT /api/imaging/orders/:id/status
 * @desc    Update imaging order status
 * @access  Private (Radiologist, Imaging Technician)
 */
router.put(
  '/orders/:id/status',
  authorize(['radiologist', 'imaging_technician']),
  updateImagingOrderStatus
);

/**
 * @route   POST /api/imaging/results
 * @desc    Create imaging result
 * @access  Private (Radiologist)
 */
router.post(
  '/results',
  authorize(['radiologist']),
  createImagingResult
);

/**
 * @route   GET /api/imaging/results
 * @desc    Get all imaging results with pagination and filtering
 * @access  Private (Doctor, Nurse, Radiologist)
 */
router.get(
  '/results',
  authorize(['doctor', 'nurse', 'radiologist']),
  getImagingResults
);

/**
 * @route   PUT /api/imaging/results/:id
 * @desc    Update imaging result
 * @access  Private (Radiologist)
 */
router.put(
  '/results/:id',
  authorize(['radiologist']),
  updateImagingResult
);

/**
 * @route   GET /api/imaging/stats
 * @desc    Get imaging statistics
 * @access  Private (Admin, Radiology Manager)
 */
router.get(
  '/stats',
  authorize(['admin', 'radiology_manager']),
  getImagingStats
);

export default router;