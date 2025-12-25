import express from 'express';
import { body, param, query } from 'express-validator';
import {
  getBills,
  getBillById,
  createBill,
  updateBill,
  getPayments,
  createPayment,
  refundPayment,
  getFinancialReports,
  getRevenueAnalytics,
  getOutstandingPayments,
} from '@/controllers/financeController';
import { authMiddleware, requireRole, requirePermission } from '@/middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Bills Management Routes
router.get(
  '/bills',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'paid', 'partially_paid', 'overdue', 'cancelled']),
    query('patientId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  requirePermission('finance:read'),
  getBills
);

router.get(
  '/bills/:id',
  [param('id').isUUID()],
  requirePermission('finance:read'),
  getBillById
);

router.post(
  '/bills',
  [
    body('patientId').isUUID(),
    body('appointmentId').optional().isUUID(),
    body('description').optional().trim().isLength({ max: 500 }),
    body('items').isArray({ min: 1 }),
    body('items.*.description').notEmpty().trim().isLength({ min: 2, max: 200 }),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.unitPrice').isFloat({ min: 0 }),
    body('items.*.category').optional().isIn(['consultation', 'procedure', 'medication', 'lab_test', 'imaging', 'room_charge', 'other']),
    body('discount').optional().isFloat({ min: 0 }),
    body('tax').optional().isFloat({ min: 0 }),
    body('dueDate').optional().isISO8601(),
  ],
  requirePermission('finance:create'),
  createBill
);

router.put(
  '/bills/:id',
  [
    param('id').isUUID(),
    body('description').optional().trim().isLength({ max: 500 }),
    body('discount').optional().isFloat({ min: 0 }),
    body('tax').optional().isFloat({ min: 0 }),
    body('dueDate').optional().isISO8601(),
    body('status').optional().isIn(['pending', 'paid', 'partially_paid', 'overdue', 'cancelled']),
  ],
  requirePermission('finance:update'),
  updateBill
);

// Payments Management Routes
router.get(
  '/payments',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['completed', 'pending', 'failed', 'refunded']),
    query('method').optional().isIn(['cash', 'card', 'bank_transfer', 'insurance', 'cheque', 'online']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  requirePermission('finance:read'),
  getPayments
);

router.post(
  '/payments',
  [
    body('billId').isUUID(),
    body('amount').isFloat({ min: 0.01 }),
    body('method').isIn(['cash', 'card', 'bank_transfer', 'insurance', 'cheque', 'online']),
    body('reference').optional().trim().isLength({ max: 100 }),
    body('notes').optional().trim().isLength({ max: 500 }),
  ],
  requirePermission('finance:create'),
  createPayment
);

router.post(
  '/payments/:id/refund',
  [
    param('id').isUUID(),
    body('amount').isFloat({ min: 0.01 }),
    body('reason').notEmpty().trim().isLength({ min: 5, max: 500 }),
  ],
  requireRole(['finance', 'admin']),
  refundPayment
);

// Outstanding Payments Routes
router.get(
  '/outstanding-payments',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('daysOverdue').optional().isInt({ min: 0 }),
  ],
  requirePermission('finance:read'),
  getOutstandingPayments
);

// Financial Reports Routes
router.get(
  '/reports',
  [
    query('type').optional().isIn(['summary', 'detailed']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  requirePermission('finance:reports'),
  getFinancialReports
);

router.get(
  '/analytics/revenue',
  [
    query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  requirePermission('finance:reports'),
  getRevenueAnalytics
);

export default router;