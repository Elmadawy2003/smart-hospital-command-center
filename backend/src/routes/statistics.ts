import { Router } from 'express';
import {
  getHospitalOverview,
  getDepartmentPerformance,
  getFinancialAnalytics,
  getPatientDemographics,
  getOperationalMetrics
} from '@/controllers/statisticsController';
import { authMiddleware, requireRole } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import { query } from 'express-validator';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Hospital Overview Statistics - accessible to admin, doctor, nurse
router.get('/overview', 
  requireRole(['admin', 'super_admin', 'doctor', 'nurse', 'manager']),
  getHospitalOverview
);

// Department Performance Statistics - accessible to admin and managers
router.get('/departments/performance',
  requireRole(['admin', 'super_admin', 'manager']),
  [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
  ],
  validate,
  getDepartmentPerformance
);

// Financial Analytics - accessible to admin, finance, and managers
router.get('/financial',
  requireRole(['admin', 'super_admin', 'accountant', 'manager']),
  [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    query('granularity').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Granularity must be daily, weekly, or monthly')
  ],
  validate,
  getFinancialAnalytics
);

// Patient Demographics - accessible to admin, doctors, and managers
router.get('/patients/demographics',
  requireRole(['admin', 'super_admin', 'doctor', 'manager']),
  getPatientDemographics
);

// Operational Metrics - accessible to admin and managers
router.get('/operational',
  requireRole(['admin', 'super_admin', 'manager']),
  [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
  ],
  validate,
  getOperationalMetrics
);

export default router;