import express from 'express';
import { query } from 'express-validator';
import {
  getDashboardOverview,
  getRealTimeStats,
  getPerformanceMetrics,
  getFinancialDashboard,
  getOperationalDashboard,
  getQualityMetrics,
} from '@/controllers/dashboardController';
import { authMiddleware, requirePermission } from '@/middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Dashboard Overview - Main KPIs
router.get(
  '/overview',
  requirePermission('dashboard:read'),
  getDashboardOverview
);

// Real-time Statistics
router.get(
  '/real-time-stats',
  requirePermission('dashboard:read'),
  getRealTimeStats
);

// Performance Metrics
router.get(
  '/performance-metrics',
  [
    query('period').optional().isInt({ min: 1, max: 365 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  requirePermission('dashboard:read'),
  getPerformanceMetrics
);

// Financial Dashboard
router.get(
  '/financial',
  [
    query('year').optional().isInt({ min: 2020, max: 2030 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
  ],
  requirePermission('finance:read'),
  getFinancialDashboard
);

// Operational Dashboard
router.get(
  '/operational',
  requirePermission('dashboard:read'),
  getOperationalDashboard
);

// Quality Metrics
router.get(
  '/quality-metrics',
  [
    query('period').optional().isInt({ min: 1, max: 365 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  requirePermission('dashboard:read'),
  getQualityMetrics
);

export default router;