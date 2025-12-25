import express from 'express';
import authRoutes from './auth';
import emrRoutes from './emr';
import pharmacyRoutes from './pharmacy';
import hrRoutes from './hr';
import financeRoutes from './finance';
import dashboardRoutes from './dashboard';
import statisticsRoutes from './statistics';
import appointmentRoutes from './appointments';
import patientRoutes from './patients';
import medicalRecordRoutes from './medical-records';
import inventoryRoutes from './inventory';
import labRoutes from './lab';
import imagingRoutes from './imaging';
import notificationRoutes from './notifications';
import reportRoutes from './reports';
import userRoutes from './users';
import { publicApiMiddlewareStack, protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger } from '@/middleware';

const router = express.Router();

// Health check endpoint (public)
router.get('/health', ...publicApiMiddlewareStack, (req, res) => {
  res.json({
    success: true,
    message: 'Hospital ERP API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// System status endpoint (public)
router.get('/status', ...publicApiMiddlewareStack, (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    success: true,
    status: 'operational',
    uptime: process.uptime(),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
    },
    timestamp: new Date().toISOString(),
  });
});

// API Routes with appropriate middleware
router.use('/auth', authRoutes); // Auth routes handle their own middleware
router.use('/emr', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('EMR Access'), emrRoutes);
router.use('/pharmacy', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Pharmacy Access'), pharmacyRoutes);
router.use('/hr', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('HR Access'), hrRoutes);
router.use('/finance', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Finance Access'), financeRoutes);
router.use('/dashboard', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Dashboard Access'), dashboardRoutes);
router.use('/statistics', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Statistics Access'), statisticsRoutes);
router.use('/appointments', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Appointments Access'), appointmentRoutes);
router.use('/patients', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Patients Access'), patientRoutes);
router.use('/medical-records', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Medical Records Access'), medicalRecordRoutes);
router.use('/inventory', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Inventory Access'), inventoryRoutes);
router.use('/lab', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Lab Access'), labRoutes);
router.use('/imaging', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Imaging Access'), imagingRoutes);
router.use('/notifications', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Notifications Access'), notificationRoutes);
router.use('/reports', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Reports Access'), reportRoutes);
router.use('/users', ...protectedApiMiddlewareStack, apiUsageLogger, userActivityLogger('Users Access'), userRoutes);

export default router;