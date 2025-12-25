import express from 'express';
import { body, param, query } from 'express-validator';
import {
  getMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  deleteMedication,
  getInventory,
  updateInventory,
  getPrescriptions,
  dispensePrescription,
  getPharmacyReports,
} from '@/controllers/pharmacyController';
import { authMiddleware, requireRole, requirePermission } from '@/middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Medications Routes
router.get(
  '/medications',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('category').optional().isString(),
  ],
  requirePermission('pharmacy:read'),
  getMedications
);

router.get(
  '/medications/:id',
  [param('id').isUUID()],
  requirePermission('pharmacy:read'),
  getMedicationById
);

router.post(
  '/medications',
  [
    body('name').notEmpty().trim().isLength({ min: 2, max: 100 }),
    body('genericName').optional().trim().isLength({ max: 100 }),
    body('brandName').optional().trim().isLength({ max: 100 }),
    body('form').notEmpty().isIn(['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other']),
    body('strength').notEmpty().trim().isLength({ max: 50 }),
    body('unit').notEmpty().trim().isLength({ max: 20 }),
    body('manufacturer').optional().trim().isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('sideEffects').optional().trim().isLength({ max: 1000 }),
    body('contraindications').optional().trim().isLength({ max: 1000 }),
    body('dosageInstructions').optional().trim().isLength({ max: 1000 }),
    body('storageInstructions').optional().trim().isLength({ max: 500 }),
    body('isActive').optional().isBoolean(),
  ],
  requirePermission('pharmacy:create'),
  createMedication
);

router.put(
  '/medications/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('genericName').optional().trim().isLength({ max: 100 }),
    body('brandName').optional().trim().isLength({ max: 100 }),
    body('form').optional().isIn(['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other']),
    body('strength').optional().trim().isLength({ max: 50 }),
    body('unit').optional().trim().isLength({ max: 20 }),
    body('manufacturer').optional().trim().isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('sideEffects').optional().trim().isLength({ max: 1000 }),
    body('contraindications').optional().trim().isLength({ max: 1000 }),
    body('dosageInstructions').optional().trim().isLength({ max: 1000 }),
    body('storageInstructions').optional().trim().isLength({ max: 500 }),
    body('isActive').optional().isBoolean(),
  ],
  requirePermission('pharmacy:update'),
  updateMedication
);

router.delete(
  '/medications/:id',
  [param('id').isUUID()],
  requirePermission('pharmacy:delete'),
  deleteMedication
);

// Inventory Routes
router.get(
  '/inventory',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['in_stock', 'low_stock', 'out_of_stock']),
    query('lowStock').optional().isBoolean(),
  ],
  requirePermission('pharmacy:read'),
  getInventory
);

router.put(
  '/inventory/:id',
  [
    param('id').isUUID(),
    body('quantity').isInt({ min: 0 }),
    body('unitPrice').isFloat({ min: 0 }),
    body('expiryDate').optional().isISO8601(),
    body('batchNumber').optional().trim().isLength({ max: 50 }),
    body('supplier').optional().trim().isLength({ max: 100 }),
    body('minimumStockLevel').optional().isInt({ min: 0 }),
  ],
  requirePermission('pharmacy:update'),
  updateInventory
);

// Prescriptions Routes
router.get(
  '/prescriptions',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'dispensed', 'cancelled']),
    query('patientId').optional().isUUID(),
  ],
  requirePermission('pharmacy:read'),
  getPrescriptions
);

router.post(
  '/prescriptions/:id/dispense',
  [
    param('id').isUUID(),
    body('quantity').isInt({ min: 1 }),
  ],
  requireRole(['pharmacist', 'admin']),
  dispensePrescription
);

// Reports Routes
router.get(
  '/reports',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  requirePermission('pharmacy:reports'),
  getPharmacyReports
);

export default router;